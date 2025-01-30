import { CLIENT_ID } from '../credentials.js';

let tokenClient;
let accounts = JSON.parse(localStorage.getItem('gdrive_accounts')) || [];

function initGoogleAPI() {
    return new Promise((resolve) => {
        gapi.load('client', () => {
            gapi.client.init({}).then(resolve);
        });
    });
}

document.getElementById('addAccountBtn').addEventListener('click', () => {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.profile',
        callback: async (response) => {
            if (response.error) {
                console.error('Authentication error:', response.error);
                return;
            }

            try {
                const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { 'Authorization': `Bearer ${response.access_token}` }
                }).then(res => res.json());

                const existingIndex = accounts.findIndex(acc => acc.email === userInfo.email);
                if (existingIndex > -1) {
                    accounts.splice(existingIndex, 1);
                }

                const storageInfo = await fetch('https://www.googleapis.com/drive/v3/about?fields=storageQuota', {
                    headers: { 'Authorization': `Bearer ${response.access_token}` }
                }).then(res => res.json());

                const account = {
                    name: userInfo.name,
                    email: userInfo.email,
                    picture: userInfo.picture,
                    accessToken: response.access_token,
                    storage: storageInfo.storageQuota
                };

                accounts.push(account);
                localStorage.setItem('gdrive_accounts', JSON.stringify(accounts));
                renderAccounts();
            } catch (error) {
                console.error('Error fetching user data:', error);
            }
        }
    });
    tokenClient.requestAccessToken({ prompt: 'consent' });
});

function renderAccounts() {
    accounts.sort((a, b) => {
        const freeA = parseInt(a.storage?.limit || 0) - parseInt(a.storage?.usage || 0);
        const freeB = parseInt(b.storage?.limit || 0) - parseInt(b.storage?.usage || 0);
        return freeB - freeA;
    });

    const accountList = document.getElementById('accountList');
    accountList.innerHTML = accounts.map((account, index) => {
        const usage = parseInt(account.storage?.usage || 0);
        const limit = parseInt(account.storage?.limit || 1);
        const usagePercentage = ((usage / limit) * 100).toFixed(1);

        let color;
        if (usagePercentage < 60) {
            color = "var(--secondary-color)";
        } else if (usagePercentage < 80) {
            color = "var(--warning-color)";
        } else {
            color = "var(--danger-color)";
        }

        return `
            <div class="account-card">
                <div class="account-header">
                    <img src="${account.picture}" class="profile-pic" alt="Profile Picture">
                    <div class="user-info">
                        <h3 class="user-name">${account.name}</h3>
                        <p class="user-email">${account.email}</p>
                    </div>
                </div>
                <div class="storage-info">
                    <div class="storage-bar">
                        <div class="storage-fill" style="width: ${usagePercentage}%; background: ${color};"></div>
                    </div>
                    <p>${formatBytes(usage)} / ${formatBytes(limit)} (${usagePercentage}%) Used</p>
                </div>
                <div class="account-actions">
                    <button class="btn btn-primary browse-btn" data-email="${account.email}"> <i class="material-symbols-outlined"> folder_open </i>Browse</button>
                    <button class="btn btn-danger disconnect-btn" data-index="${index}"><i class="material-symbols-outlined">  do_not_disturb_on </i></button>
                </div>
            </div>
        `;
    }).join('');

    document.querySelectorAll('.browse-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const email = e.target.dataset.email;
            handleBrowseClick(email);
        });
    });

    document.querySelectorAll('.disconnect-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            disconnectAccount(index);
        });
    });
}

function formatBytes(bytes) {
    bytes = parseInt(bytes);
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function disconnectAccount(index) {
    accounts.splice(index, 1);
    localStorage.setItem('gdrive_accounts', JSON.stringify(accounts));
    renderAccounts();
}

function handleBrowseClick(email) {
    const account = accounts.find(acc => acc.email === email);
    if (account) {
        window.location.href = `browse.html?account=${encodeURIComponent(email)}`;
    } else {
        alert('Account not found!');
    }
}

(async () => {
    await initGoogleAPI();
    renderAccounts();
})();

document.getElementById('searchBtn').addEventListener('click', async () => {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return alert("Please enter a folder name!");

    document.getElementById('accountList').style.display = 'none';
    document.getElementById('accountTitle').style.display = 'none';
    document.getElementById('searchTitle').style.display = 'block';

    const searchResults = await searchAcrossAccounts(query);
    renderSearchResults(searchResults);
});

async function searchAcrossAccounts(query) {
    const results = [];
    for (const account of accounts) {
        try {
            const folders = await searchFolders(account, query);
            if (folders.length > 0) {
                results.push({ account, folders });
            }
        } catch (error) {
            console.error(`Error searching in ${account.email}:`, error);
        }
    }
    return results;
}

async function searchFolders(account, query) {
    const folders = [];
    const accessToken = account.accessToken;

    try {
        const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=name contains '${query}' and mimeType='application/vnd.google-apps.folder'&fields=files(id, name, modifiedTime, owners)`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        const data = await response.json();
        if (data.files) {
            data.files.forEach(file => {
                folders.push(file);
            });
        }
    } catch (error) {
        console.error('Error fetching folders:', error);
    }

    return folders;
}

function renderSearchResults(results) {
    const searchResultsDiv = document.getElementById('searchResults');
    searchResultsDiv.innerHTML = '';

    if (results.length === 0) {
        searchResultsDiv.innerHTML = '<p>No folders found.</p>';
        return;
    }

    let content = results.map(result => {
        const { account, folders } = result;

        return `
            <div class="account-card">
                <div class="account-header">
                    <img src="${account.picture}" class="profile-pic" alt="Profile Picture">
                    <div class="user-info">
                        <h3>${escapeHTML(account.name)}</h3>
                        <p>${escapeHTML(account.email)}</p>
                    </div>
                </div>
                <div class="folder-list">
                    <h4>Found Folders:</h4>
                    ${folders.map(folder => `
                        <div class="folder-item">
                            <div>
                                <strong>${escapeHTML(folder.name)}</strong>
                                <p>Last Modified: ${new Date(folder.modifiedTime).toLocaleString()}</p>
                                <p>Owner: ${escapeHTML(folder.owners?.[0]?.displayName || 'Unknown')}</p>
                            </div>
                            <button class="browse-btn btn" data-account="${encodeURIComponent(account.email)}" data-folder="${encodeURIComponent(folder.id)}">
                                <i class="material-symbols-outlined">folder_open</i>
                            </button>
                            <button class="copy-btn btn" data-id="${encodeURIComponent(folder.id)}" title="Copy Folder ID">
                                <i class="material-symbols-outlined">content_copy</i>
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');

    searchResultsDiv.innerHTML = content;

    // Use event delegation for efficiency
    searchResultsDiv.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;

        if (btn.classList.contains('browse-btn')) {
            const email = btn.dataset.account;
            const folderId = btn.dataset.folder;
            window.location.href = `browse.html?account=${email}&folder=${folderId}`;
        } else if (btn.classList.contains('copy-btn')) {
            const folderId = btn.dataset.id;
            navigator.clipboard.writeText(folderId);

            // Change icon temporarily
            const icon = btn.querySelector('i');
            icon.innerText = 'check';

            setTimeout(() => {
                icon.innerText = 'content_copy';
            }, 1000);
        }
    });
}

// Helper function to escape HTML to prevent XSS
function escapeHTML(str) {
    return str.replace(/[&<>"']/g, (match) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    }[match]));
}
