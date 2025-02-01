// Replace with your actual Google API Client ID


// Load existing accounts from localStorage or use an empty array
let accounts = JSON.parse(localStorage.getItem('gdrive_accounts')) || [];

// Global token client (used for initial login)
let tokenClient;

// Function to handle the "Add Google Account" button click (initial consent)
function handleAuthClick() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
    callback: async (response) => {
      if (response.error) {
        console.error('Error during initial consent:', response.error);
        return;
      }
      // Calculate token expiry time in milliseconds
      const expiresIn = response.expires_in * 1000;
      const expiry = Date.now() + expiresIn;

      // Fetch user info
      const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { 'Authorization': `Bearer ${response.access_token}` }
      }).then(res => res.json());

      // Fetch storage info
      const storageInfo = await getStorageInfo(response.access_token);

      // Check if account already exists
      const existingAccount = accounts.find(acc => acc.email === userInfo.email);
      if (existingAccount) {
        // Update the existing account with the latest token, expiry, & storage info
        existingAccount.accessToken = response.access_token;
        existingAccount.expiry = expiry;
        existingAccount.storage = storageInfo;
      } else {
        // Add new account
        accounts.push({
          name: userInfo.name || 'Google User',
          email: userInfo.email || 'Email Not Found',
          picture: userInfo.picture || 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
          accessToken: response.access_token,
          expiry: expiry,
          storage: storageInfo
        });
      }

      // Save updated accounts to localStorage and re-render
      localStorage.setItem('gdrive_accounts', JSON.stringify(accounts));
      renderAccounts();
    }
  });
  // Request token with consent prompt on initial login
  tokenClient.requestAccessToken({ prompt: 'consent' });
}

// Function to silently refresh an expired token for a given account
async function refreshAccountToken(account) {
  return new Promise((resolve, reject) => {
    // Create a new token client for silent refresh using a login hint
    const refreshClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
      hint: account.email, // specify the account email to refresh
      callback: async (response) => {
        if (response.error) {
          console.error('Silent refresh failed for account:', account.email, response.error);
          resolve(false);
          return;
        }
        // Update token expiration info
        const expiresIn = response.expires_in * 1000;
        const expiry = Date.now() + expiresIn;
        account.accessToken = response.access_token;
        account.expiry = expiry;
        // Optionally update storage info
        account.storage = await getStorageInfo(response.access_token);
        resolve(true);
      }
    });
    // For silent refresh, do not force the consent prompt
    refreshClient.requestAccessToken();
  });
}

// Function to fetch storage info from Google Drive
async function getStorageInfo(accessToken) {
  try {
    const response = await fetch('https://www.googleapis.com/drive/v3/about?fields=storageQuota', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const data = await response.json();
    return {
      limit: data.storageQuota?.limit || 0,
      usage: data.storageQuota?.usage || 0,           // Total storage used
      usageInDrive: data.storageQuota?.usageInDrive || 0, // Drive storage usage
      usageInTrash: data.storageQuota?.usageInDriveTrash || 0  // Trash usage
    };
  } catch (error) {
    console.error('Error fetching storage info:', error);
    return { limit: 0, usage: 0, usageInDrive: 0, usageInTrash: 0 };
  }
}

// Function to update storage info on page load and attempt silent refresh if token expired
async function updateStorageOnLoad() {
  for (let account of accounts) {
    if (account.accessToken) {
      // Check if token has expired (or is about to expire)
      if (Date.now() > account.expiry) {
        // Attempt silent refresh for expired token
        await refreshAccountToken(account);
      } else {
        // If token is still valid, simply update storage info
        account.storage = await getStorageInfo(account.accessToken);
      }
    }
  }
  localStorage.setItem('gdrive_accounts', JSON.stringify(accounts));
  renderAccounts();
}

// Function to render the list of accounts
function renderAccounts() {
  // Sort accounts by free storage available (largest free space first)
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
      color = "var(--secondary-color)";  // Green
    } else if (usagePercentage < 80) {
      color = "var(--warning-color)";    // Yellow
    } else {
      color = "var(--danger-color)";     // Red
    }

    return `
      <div class="account-card">
        <button class="btn btn-danger" onclick="disconnectAccount(${index})"><i class="material-symbols-outlined">do_not_disturb_on</i></button>
        <div class="account-header">
          <img src="${account.picture}" class="profile-pic">
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
          <p style="font-size: 12px;"><i class="fa-regular fa-hard-drive"></i>  ${formatBytes(account.storage.usageInDrive)} | <i class="fa-regular fa-trash-can"></i>  ${formatBytes(account.storage.usageInTrash)}</p>
        </div>

        <div style="text-align: center;">
          <button class="btn btn-primary" onclick="handleBrowseClick('${account.email}')"><i class="material-symbols-outlined">folder_open</i> Browse</button>
        </div>
      </div>
    `;
  }).join('');
}

// Function to format bytes into a human-readable format
function formatBytes(bytes) {
  bytes = parseInt(bytes);
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Function to disconnect an account
function disconnectAccount(index) {
  accounts.splice(index, 1);
  localStorage.setItem('gdrive_accounts', JSON.stringify(accounts));
  renderAccounts();
}

// Function to handle the "Browse" button click
function handleBrowseClick(email) {
  window.location.href = `browse.html?account=${encodeURIComponent(email)}`;
}

// Update storage info (and refresh tokens if needed) only when the page loads or reloads
window.addEventListener('load', async () => {
  await updateStorageOnLoad();
});

// Render accounts initially
renderAccounts();


        //search btn

        document.getElementById('searchBtn').addEventListener('click', handleSearch);
        document.getElementById('searchInput').addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                handleSearch();
            }
        });
        
        // Function to handle search request across multiple accounts
        async function handleSearch() {
            const searchQuery = document.getElementById('searchInput').value.trim();
            if (!searchQuery) return;
        
            if (accounts.length === 0) {
                alert('No Google Drive accounts connected.');
                return;
            }
        
            // Disable account list and show back button
            document.getElementById('accountList').style.display = 'none';
            document.getElementById('accountTitle').style.display = 'none';
            document.getElementById('backBtn').style.display = 'block';
        
            document.getElementById('searchResults').innerHTML = '<p>Searching...</p>';
            document.getElementById('searchTitle').style.display = 'block';
        
            const searchPromises = accounts.map(account => searchFolders(account, searchQuery));
            const results = await Promise.all(searchPromises);
        
            renderSearchResults(results.map((folders, index) => ({
                account: accounts[index],
                folders
            })));
        }
        
        // Function to search folders in a specific account
        async function searchFolders(account, query) {
            const accessToken = account.accessToken;
            const folders = [];
        
            try {
                const response = await fetch(
                    `https://www.googleapis.com/drive/v3/files?q=name contains '${query}' and mimeType='application/vnd.google-apps.folder'&fields=files(id, name, modifiedTime, owners)`, 
                    {
                        headers: { Authorization: `Bearer ${accessToken}` }
                    }
                );
        
                const data = await response.json();
                if (data.files) {
                    folders.push(...data.files);
                }
            } catch (error) {
                console.error(`Error fetching folders for ${account.email}:`, error);
            }
        
            return folders;
        }
        
        // Function to render search results
        function renderSearchResults(results) {
            const searchResultsDiv = document.getElementById('searchResults');
            searchResultsDiv.innerHTML = '';
        
            if (results.every(result => result.folders.length === 0)) {
                searchResultsDiv.innerHTML = '<p>No folders found.</p>';
                return;
            }
        
            searchResultsDiv.innerHTML = results.map(result => {
                const { account, folders } = result;
        
                if (folders.length === 0) return '';
        
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
        
            attachEventListeners();
        }
        
        // Function to return to account list
        function resetSearch() {
            location.reload();
        }
        
        // Function to safely escape HTML to prevent XSS attacks
        function escapeHTML(str) {
            return str.replace(/[&<>"']/g, match => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            })[match]);
        }
        
        // Function to attach event listeners (event delegation)
        function attachEventListeners() {
            document.getElementById('searchResults').addEventListener('click', (e) => {
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
        