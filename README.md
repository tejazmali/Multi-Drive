## ☕ Support Me

If you enjoy my work or find my projects helpful, consider supporting me:

<a href="https://www.buymeacoffee.com/tejazmali" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 45px; width: 162px;">
</a>

> ☕ Every little bit helps me keep building cool projects and open-source tools. Thanks for your support! 🙌

---



<img src="img/logo.png" width="100" style="" />  

# Multi Drive

A simple web application to manage multiple Google Drive accounts, browse files, and view storage usage. Built with HTML, CSS, and JavaScript using the Google Drive API.

![Screenshot](https://github.com/tejazmali/Multi-Drive/blob/4d7a0f4d0cf7aff28bfe4fa6b36945cca6945dd7/img/Screenshot%202025-02-01%20010054.png)
![Screenshot](https://github.com/tejazmali/Multi-Drive/blob/4d7a0f4d0cf7aff28bfe4fa6b36945cca6945dd7/img/Screenshot%202025-02-01%20010116.png) <!-- Add a screenshot if available -->

---

## Features

- **Add Multiple Google Accounts**: Sign in with multiple Google accounts and manage them in one place.
- **Browse Files and Folders**: View files and folders in your Google Drive with a hierarchical structure.
- **Storage Usage**: Visualize storage usage with a progress bar.
- **Local Storage**: Save account data locally for quick access.
- **Drag-and-Drop Upload**: Upload files to Google Drive using drag-and-drop (optional).

---

## Prerequisites

Before running the project, ensure you have the following:

1. **Google Cloud Project**:
   - Create a project in the [Google Cloud Console](https://console.cloud.google.com/).
   - Enable the **Google Drive API** and **Google OAuth 2.0 API**.
   - Create OAuth 2.0 credentials (Client ID and Client Secret).

2. **Node.js**:
   - Install [Node.js](https://nodejs.org/) to run a local server.

3. **Git**:
   - Install [Git](https://git-scm.com/) to clone the repository.

---

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/tejazmali/Multi-Drive.git
cd Multi-Drive
```

### 2. Set Up Google API Credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Navigate to **APIs & Services → Credentials**.
3. Create an **OAuth 2.0 Client ID**.
4. Add `http://localhost:3000` to **Authorized JavaScript origins** and **Authorized redirect URIs**.
5. Download the `credentials.json` file and rename it to `credentials.js`.
6. Update `credentials.js` with your Client ID and API Key:

```javascript
// credentials.js
export const CLIENT_ID = 'your-client-id.apps.googleusercontent.com';
export const API_KEY = 'your-api-key';
```
7. Add `credentials.js` to Multi-Drive Folder:


### 3. Install Dependencies

Install the required dependencies to run a local server:

```bash
npm install -g serve
```

### 4. Run the Project

Start the local server:

```bash
serve
```

Open your browser and navigate to:

```
http://localhost:3000
```

---

## Usage

1. **Add Google Account**:
   - Click the **Add Google Account** button.
   - Sign in with your Google account and grant the required permissions.

2. **Browse Files**:
   - Click the **Browse** button on an account card to view files and folders.
   - Expand folders to view their contents.

3. **Disconnect Account**:
   - Click the **Disconnect** button to remove an account.



---

## Troubleshooting

### 1. "Unverified App" Warning
- Add your email as a **Test User** in the Google Cloud Console under **OAuth consent screen**.

### 2. Authentication Errors
- Ensure the **Authorized JavaScript origins** and **Authorized redirect URIs** in the Google Cloud Console match `http://localhost:3000`.

### 3. CORS Issues
- Use a local server (e.g., `serve`) instead of opening the files directly (`file://` protocol).

---

## Contributing

Contributions are welcome! Follow these steps:

1. Fork the repository.
2. Create a new branch (`git checkout -b feature/your-feature`).
3. Commit your changes (`git commit -m 'Add some feature'`).
4. Push to the branch (`git push origin feature/your-feature`).
5. Open a pull request.

---




Enjoy managing your Google Drive accounts locally! 🚀

---

