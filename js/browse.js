// ===== Global Variables =====
let accessToken;
let currentAccount;
let selectedDestinationId = 'root';
let selectedFiles = new Set();
let draggedItemData = null; // For drag & drop move functionality

// Replace these with your own credentials (if needed)
const CLIENT_ID = 'YOUR_CLIENT_ID';
const CLIENT_SECRET = 'YOUR_CLIENT_SECRET';

// ===== Dummy refreshAccessToken function =====
async function refreshAccessToken() {
    console.log("Refreshing access token...");
    // In your real implementation, refresh the token using your refresh token logic.
    // For demo purposes, we simply resolve after a short delay.
    return new Promise(resolve => {
        setTimeout(() => {
            console.log("Access token refreshed.");
            resolve();
        }, 1000);
    });
}

// ===== API Functions =====
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

async function getRefreshToken(accessToken) {
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET, // Ensure this is kept secret
            grant_type: 'authorization_code',
            code: accessToken
        })
    });

    const data = await response.json();
    return data.refresh_token;
}

// ===== Helper Functions =====
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

// ===== Rendering Functions =====
function renderContents(files, parentElement) {
    parentElement.innerHTML = ''; // Clear existing content

    if (files.length === 0) {
        // Create and show the enhanced placeholder
        const placeholder = document.createElement('div');
        placeholder.className = 'placeholder-nofile';
        placeholder.innerHTML = `
            <img src="https://ssl.gstatic.com/docs/doclist/images/empty_state_my_drive_v2.svg" alt="No files">
            <div class="guXkdd">A place for all of your files</div>
            <div class="SCe7Ib">
                Drag your files and folders here or use the " 
                <i class="fa-solid fa-folder-plus"></i>" button to create folder
            </div>
        `;
        parentElement.appendChild(placeholder);
    } else {
        // Render files as normal
        files.forEach(file => {
            const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
            const iconClass = getFileIcon(file.mimeType);
            const size = file.size ? formatBytes(file.size) : '';
            const modifiedTime = file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : '';

            const itemDiv = document.createElement('div');
            itemDiv.className = 'drive-item';
            // Store the file object on the element (as a JSON string) if needed later.
            itemDiv.dataset.file = JSON.stringify(file);
            // Make every drive item draggable
            itemDiv.setAttribute('draggable', 'true');

            itemDiv.innerHTML = `
                <div class="item-header">
                    <input type="checkbox" class="file-checkbox" 
                        data-file-id="${file.id}" 
                        data-parents='${JSON.stringify(file.parents || [])}'>
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

            // === DRAG & DROP MOVE FUNCTIONALITY ===
            // When drag starts, save the file data to a global variable.
            itemDiv.addEventListener('dragstart', (e) => {
                draggedItemData = file;
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', file.id);
                itemDiv.classList.add('dragging');
            });

            // Remove dragging class when drag ends.
            itemDiv.addEventListener('dragend', (e) => {
                itemDiv.classList.remove('dragging');
            });

            // If this item is a folder, enable it to accept dropped items.
            if (isFolder) {
                // Allow drop by preventing the default behavior.
                itemDiv.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    itemDiv.classList.add('drag-over');
                });

                itemDiv.addEventListener('dragleave', (e) => {
                    itemDiv.classList.remove('drag-over');
                });

                itemDiv.addEventListener('drop', async (e) => {
                    e.preventDefault();
                    itemDiv.classList.remove('drag-over');
                    const newParentId = file.id;
                    // Prevent dropping an item on itself
                    if (draggedItemData && draggedItemData.id === newParentId) {
                        showToast('Cannot move a folder into itself!', true);
                        return;
                    }
                    await moveItem(draggedItemData, newParentId);
                    draggedItemData = null;
                });
            }
        });
    }
}

// ===== API Actions =====
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
    const childrenDiv = button.closest('.drive-item').querySelector('.children');
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
        if (childrenDiv.style.display === 'none' || childrenDiv.style.display === '') {
            childrenDiv.style.display = 'block';
            icon.className = 'fas fa-caret-down';
        } else {
            childrenDiv.style.display = 'none';
            icon.className = 'fas fa-caret-right';
        }
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

    const xhr = new XMLHttpRequest();

    // Show progress bar
    document.getElementById('uploadProgressContainer').style.display = 'block';

    xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart');
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);

    // Update progress
    xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
            const percentage = (event.loaded / event.total) * 100;
            document.getElementById('uploadProgress').value = percentage;
            document.getElementById('uploadProgressText').textContent = `Uploading... ${Math.round(percentage)}%`;
        }
    });

    // Handle completion
    xhr.onload = async () => {
        if (xhr.status === 200) {
            showToast('File uploaded successfully!');
            refreshContents();
        } else {
            console.error('Error uploading file:', xhr.responseText);
            showToast('Failed to upload file!', true);
        }
        // Hide progress bar
        document.getElementById('uploadProgressContainer').style.display = 'none';
    };

    // Handle error
    xhr.onerror = () => {
        console.error('Error uploading file');
        showToast('Failed to upload file!', true);
        // Hide progress bar
        document.getElementById('uploadProgressContainer').style.display = 'none';
    };

    // Send request
    xhr.send(formData);
}

async function deleteFile(fileId) {
    try {
        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!response.ok) {
            throw new Error("Delete request failed");
        }
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
        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: newName })
        });
        if (!response.ok) {
            throw new Error("Rename request failed");
        }
        showToast('File/folder renamed successfully!');
        return true;
    } catch (error) {
        console.error('Error renaming file:', error);
        showToast('Failed to rename file/folder!', true);
        return false;
    }
}

// ===== DRAG & DROP SETUP FOR UPLOADING FILES =====
function setupDragAndDrop() {
    // Create visual drop zone overlay
    const dropOverlay = document.createElement('div');
    dropOverlay.id = 'globalDropOverlay';
    dropOverlay.innerHTML = '<div class="drop-message">Drop files to upload</div>';
    document.body.appendChild(dropOverlay);

    // Handle dragover on entire page
    document.addEventListener('dragover', (e) => {
        if (e.dataTransfer.items.length > 0 && e.dataTransfer.items[0].kind === 'file') {
            e.preventDefault();
            dropOverlay.style.display = 'flex';
        }
    });

    // Handle dragleave
    document.addEventListener('dragleave', (e) => {
        if (!e.relatedTarget || e.relatedTarget.nodeName === 'HTML') {
            dropOverlay.style.display = 'none';
        }
    });

    // Handle file drop for uploads
    document.addEventListener('drop', async (e) => {
        // Prevent default drop behavior only if files are dropped
        if (e.dataTransfer.files.length) {
            e.preventDefault();
            dropOverlay.style.display = 'none';

            // Get current folder ID from the main view
            const driveContents = document.getElementById('driveContents');
            const currentFolderId = driveContents.dataset.folderId || 'root';

            // Handle file uploads
            const files = e.dataTransfer.files;
            for (const file of files) {
                await uploadFile(file, currentFolderId);
            }
        }
    });
    
    // --- Added Feature: Open File Explorer on click ---
    const dropZone = document.getElementById('dropZone');
    const hiddenFileInput = document.getElementById('hiddenFileInput');
    
    // When the drop zone is clicked, trigger the hidden file input
    dropZone.addEventListener('click', () => {
        hiddenFileInput.click();
    });
    
    // When files are selected via the file explorer, upload them
    hiddenFileInput.addEventListener('change', async (e) => {
        const driveContents = document.getElementById('driveContents');
        const currentFolderId = driveContents.dataset.folderId || 'root';
        const files = e.target.files;
        for (const file of files) {
            await uploadFile(file, currentFolderId);
        }
        // Reset the input value so that the same file can be selected again if needed
        hiddenFileInput.value = '';
    });
}

// ===== CSS for Drop Zone Overlay =====
const dropZoneCSS = `
#globalDropOverlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.6);
    display: none;
    justify-content: center;
    align-items: center;
    z-index: 9999;
    pointer-events: none;
}

.drop-message {
    padding: 20px 40px;
    color: rgb(255, 255, 255);
    border-radius: 8px;
    font-size: 1.5rem;
}

/* Highlight folder when dragging over */
.drive-item.drag-over {
    border: 1px solid #007bff;
    background-color: #f0f8ff;
}

/* Styling for the item being dragged */
.drive-item.dragging {
    opacity: 0.5;
}
`;
const styleSheet = document.createElement("style");
styleSheet.textContent = dropZoneCSS;
document.head.appendChild(styleSheet);

// ===== Refresh & Utility Functions =====
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

// ===== MOVE Functionality (Using Checkboxes) =====
async function confirmMove() {
    const checkboxes = document.querySelectorAll('.file-checkbox:checked');
    if (checkboxes.length === 0) return;

    const newParentId = selectedDestinationId;
    try {
        const movePromises = Array.from(checkboxes).map(async (checkbox) => {
            const fileId = checkbox.dataset.fileId;
            const oldParents = JSON.parse(checkbox.dataset.parents);
            const params = new URLSearchParams();
            params.append('addParents', newParentId);
            oldParents.forEach(parent => params.append('removeParents', parent));
            const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?${params.toString()}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error(`Failed to move file ${fileId}`);
            }
        });
        
        await Promise.all(movePromises);
        showToast('Files moved successfully!');
        refreshContents();
    } catch (error) {
        console.error('Error moving files:', error);
        showToast('Failed to move files!', true);
    }

    document.getElementById('folderPickerModal').style.display = 'none';
    checkboxes.forEach(checkbox => checkbox.checked = false);
    document.getElementById('moveButton').disabled = true;
}

// ===== MOVE: Single Item Function =====
async function moveItem(item, newParentId) {
    // Use the old parents stored on the item, or default to an empty array.
    const oldParents = item.parents || [];
    const params = new URLSearchParams();
    params.append('addParents', newParentId);
    oldParents.forEach(parent => params.append('removeParents', parent));

    try {
        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${item.id}?${params.toString()}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        if (response.ok) {
            showToast('Item moved successfully!');
            refreshContents();
        } else {
            throw new Error("Move request failed");
        }
    } catch (error) {
        console.error('Error moving item:', error);
        showToast('Failed to move item!', true);
    }
}

// ===== Modal Functions for MOVE (Multiple Items) =====
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

// ===== DOMContentLoaded & Initial Setup =====
document.addEventListener('DOMContentLoaded', async () => {
    setupDragAndDrop();

    // Retrieve account information from URL and localStorage
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

    // Move button handler: open modal and fetch folders
    document.getElementById('moveButton').addEventListener('click', () => {
        document.getElementById('folderPickerModal').style.display = 'block';
        fetchAndRenderModalFolders('root');
    });

    // Checkbox change handler: enable/disable move button based on selection
    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('file-checkbox')) {
            const anyChecked = document.querySelectorAll('.file-checkbox:checked').length > 0;
            document.getElementById('moveButton').disabled = !anyChecked;
        }
    });

    // Modal close handler
    document.querySelector('.close-modal').addEventListener('click', () => {
        document.getElementById('folderPickerModal').style.display = 'none';
    });

    // Close modal if clicking outside of modal content
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
