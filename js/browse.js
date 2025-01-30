let accessToken;
let currentAccount;
let selectedDestinationId = 'root';
let selectedFiles = new Set();

async function fetchDriveContents(folderId = "root") {
    try {
        let response = await fetch(`https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents&fields=files(id,name,mimeType,size,modifiedTime,parents)`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (response.status === 401) {
            console.warn("Access token expired. Refreshing...");
            await refreshAccessToken();
            return fetchDriveContents(folderId); // Retry after refresh
        }

        const data = await response.json();
        return data.files;
    } catch (error) {
        console.error("Error fetching Drive contents:", error);
        return [];
    }
}
async function refreshAccessToken() {
    if (!currentAccount || !currentAccount.refreshToken) {
        console.error("No refresh token available!");
        return;
    }

    try {
        const response = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: "YOUR_CLIENT_ID",
                client_secret: "YOUR_CLIENT_SECRET",
                refresh_token: currentAccount.refreshToken,
                grant_type: "refresh_token",
            }),
        });

        const data = await response.json();

        if (data.access_token) {
            currentAccount.accessToken = data.access_token;
            localStorage.setItem("gdrive_accounts", JSON.stringify([currentAccount]));
            accessToken = data.access_token;
            console.log("Token refreshed successfully!");
        } else {
            console.error("Failed to refresh token:", data);
        }
    } catch (error) {
        console.error("Error refreshing access token:", error);
    }
}

function getFileIcon(mimeType) {
    const iconMap = {
        'application/vnd.google-apps.folder': 'fa-folder',
        'application/vnd.google-apps.document': 'fa-file-word',
        'application/vnd.google-apps.spreadsheet': 'fa-file-excel',
        'application/vnd.google-apps.presentation': 'fa-file-powerpoint',
        'image/jpeg': 'fa-file-image',
        'image/png': 'fa-file-image',
        'image/gif': 'fa-file-image',
        'application/pdf': 'fa-file-pdf',
        'application/zip': 'fa-file-zipper',
        'text/plain': 'fa-file-lines',
        'audio/mpeg': 'fa-file-audio',
        'video/mp4': 'fa-file-video'
    };
    return iconMap[mimeType] || 'fa-file';
}

function formatBytes(bytes) {
    if (!bytes) return '';
    bytes = parseInt(bytes);
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function renderContents(files, parentElement) {
    parentElement.innerHTML = '';
    files.forEach(file => {
        const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
        const iconClass = getFileIcon(file.mimeType);
        const size = file.size ? formatBytes(file.size) : '';
        const modifiedTime = new Date(file.modifiedTime).toLocaleDateString();

        const itemDiv = document.createElement('div');
        itemDiv.className = 'drive-item';
        itemDiv.innerHTML = `
            <div class="item-header">
                <input type="checkbox" class="file-checkbox" 
                    data-file-id="${file.id}" 
                    data-parents='${JSON.stringify(file.parents)}'>
                <div class="item-icon">
                    <i class="fas ${iconClass}"></i>
                </div>
                <span class="item-name">${file.name}</span>
                <div class="item-actions">
                    ${!isFolder ? `<span class="file-info">${size} • ${modifiedTime}</span>` : ''}
                    <button class="copy-btn" onclick="copyToClipboard('${file.id}')">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="rename-btn" onclick="renameItem('${file.id}', '${file.name}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="delete-btn" onclick="deleteItem('${file.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                    ${isFolder ? `
                        <button class="expand-btn" onclick="toggleFolder('${file.id}', this)">
                            <i class="fas fa-caret-right"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
            <div class="children"></div>
        `;
        parentElement.appendChild(itemDiv);
    });
}


async function createFolder() {
const folderName = prompt("Enter folder name:");
if (!folderName) return;

const metadata = {
name: folderName,
mimeType: "application/vnd.google-apps.folder",
parents: [selectedDestinationId] // Uses the currently selected folder as the parent
};

try {
const response = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
    },
    body: JSON.stringify(metadata)
});

if (response.ok) {
    showToast("Folder created successfully!");
    refreshContents();
} else {
    throw new Error("Failed to create folder");
}
} catch (error) {
console.error("Error creating folder:", error);
showToast("Failed to create folder!", true);
}
}



async function toggleFolder(folderId, button) {
    const childrenDiv = button.closest('.item-header').nextElementSibling;
    const icon = button.querySelector('i');
    
    if (childrenDiv.children.length === 0) {
        button.disabled = true;
        icon.className = 'fas fa-spinner loading';
        try {
            const files = await fetchDriveContents(folderId);
            renderContents(files, childrenDiv);
            icon.className = 'fas fa-caret-down';
            childrenDiv.style.display = 'block';
        } catch (error) {
            console.error('Error fetching folder contents:', error);
            icon.className = 'fas fa-exclamation-triangle';
            showToast('Failed to load folder!', true);
        } finally {
            button.disabled = false;
        }
    } else {
        childrenDiv.style.display = childrenDiv.style.display === 'none' ? 'block' : 'none';
        icon.className = childrenDiv.style.display === 'none' 
            ? 'fas fa-caret-right' 
            : 'fas fa-caret-down';
    }
}

async function uploadFile(file, parentId = 'root') {
    const metadata = {
        name: file.name,
        parents: [parentId]
    };

    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', file);

    try {
        await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}` },
            body: formData
        });
        showToast('File uploaded successfully!');
        refreshContents();
    } catch (error) {
        console.error('Error uploading file:', error);
        showToast('Failed to upload file!', true);
    }
}

async function deleteFile(fileId) {
    try {
        await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        showToast('File/folder deleted successfully!');
        return true;
    } catch (error) {
        console.error('Error deleting file:', error);
        showToast('Failed to delete file/folder!', true);
        return false;
    }
}

async function renameFile(fileId, newName) {
    try {
        await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: newName })
        });
        showToast('File/folder renamed successfully!');
        return true;
    } catch (error) {
        console.error('Error renaming file:', error);
        showToast('Failed to rename file/folder!', true);
        return false;
    }
}

function setupDragAndDrop() {
    const dropZone = document.getElementById('dropZone');

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');

        const files = e.dataTransfer.files;
        for (const file of files) {
            await uploadFile(file);
        }
    });
}

async function refreshContents() {
    const driveContents = document.getElementById('driveContents');
    const currentFolderId = driveContents.dataset.folderId || 'root';
    const files = await fetchDriveContents(currentFolderId);
    renderContents(files, driveContents);
    document.getElementById('moveButton').disabled = true;
}

async function renameItem(fileId, currentName) {
    const newName = prompt('Enter new name:', currentName);
    if (newName && newName !== currentName) {
        const success = await renameFile(fileId, newName);
        if (success) refreshContents();
    }
}

async function deleteItem(fileId) {
    if (confirm('Are you sure you want to delete this file/folder?')) {
        const success = await deleteFile(fileId);
        if (success) refreshContents();
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
        .then(() => showToast('Copied to clipboard!'))
        .catch(() => showToast('Failed to copy!', true));
}

function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.background = isError ? '#dc3545' : '';
    toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', 2000);
}

// Move functionality functions
async function confirmMove() {
    const checkboxes = document.querySelectorAll('.file-checkbox:checked');
    const filesToMove = Array.from(checkboxes).map(checkbox => ({
        id: checkbox.dataset.fileId,
        oldParents: JSON.parse(checkbox.dataset.parents)
    }));
    const newParentId = selectedDestinationId;

    try {
        const movePromises = filesToMove.map(file => {
            const params = new URLSearchParams();
            params.append('addParents', newParentId);
            file.oldParents.forEach(parent => params.append('removeParents', parent));
            return fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?${params}`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
        });
        
        await Promise.all(movePromises);
        showToast('Files moved successfully!');
        refreshContents();
    } catch (error) {
        console.error('Error moving files:', error);
        showToast('Failed to move some files!', true);
    }

    document.getElementById('folderPickerModal').style.display = 'none';
    checkboxes.forEach(checkbox => checkbox.checked = false);
    document.getElementById('moveButton').disabled = true;
}

async function fetchAndRenderModalFolders(folderId = 'root') {
    const modalFolderContents = document.getElementById('modalFolderContents');
    const files = await fetchDriveContents(folderId);
    const folders = files.filter(file => file.mimeType === 'application/vnd.google-apps.folder');
    renderModalFolders(folders, modalFolderContents);
    selectedDestinationId = folderId;
}

function renderModalFolders(folders, parentElement) {
    parentElement.innerHTML = '';
    folders.forEach(folder => {
        const folderDiv = document.createElement('div');
        folderDiv.className = 'modal-folder-item';
        folderDiv.innerHTML = `
            <i class="fas fa-folder"></i>
            <span class="folder-name">${folder.name}</span>
            <button class="enter-folder-btn" onclick="fetchAndRenderModalFolders('${folder.id}')">
                <i class="fa-solid fa-arrow-up-right-from-square"></i>
            </button>
        `;
        parentElement.appendChild(folderDiv);
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    setupDragAndDrop();

    const urlParams = new URLSearchParams(window.location.search);
    const accountEmail = decodeURIComponent(urlParams.get('account'));
    const accounts = JSON.parse(localStorage.getItem('gdrive_accounts')) || [];
    currentAccount = accounts.find(acc => acc.email === accountEmail);

    if (!currentAccount) {
        window.location.href = 'index.html';
        return;
    }

    accessToken = currentAccount.accessToken;
    refreshContents();

     // 🔄 Auto Refresh Token Every 50 Minutes
     setInterval(refreshAccessToken, 50 * 60 * 1000);

    // Move button handlers
    document.getElementById('moveButton').addEventListener('click', () => {
        document.getElementById('folderPickerModal').style.display = 'block';
        fetchAndRenderModalFolders('root');
    });

    // Checkbox change handler
    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('file-checkbox')) {
            const anyChecked = document.querySelectorAll('.file-checkbox:checked').length > 0;
            document.getElementById('moveButton').disabled = !anyChecked;
        }
    });

    // Modal close handlers
    document.querySelector('.close-modal').addEventListener('click', () => {
        document.getElementById('folderPickerModal').style.display = 'none';
    });


    window.onclick = (event) => {
        const modal = document.getElementById('folderPickerModal');
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };
});

document.addEventListener("DOMContentLoaded", () => {
document.querySelector(".create-folder-button").addEventListener("click", createFolder);
});