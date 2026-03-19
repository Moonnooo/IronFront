# How to Run IronFront - Command Prompt Guide

## Prerequisites

Make sure you have Node.js installed on your computer.
- Download from: https://nodejs.org/
- Install it, then restart Command Prompt

To check if Node.js is installed, type:
```
node --version
```

## Step-by-Step Instructions

### Step 1: Open Command Prompt

1. Press `Windows Key + R`
2. Type `cmd` and press Enter
   - OR search for "Command Prompt" in the Start menu

### Step 2: Navigate to the Project Folder

Type this command (replace with your actual path):
```
cd C:\Users\xxred\Desktop\IronFront
```

Press Enter.

**Tip:** You can also:
- Navigate to the folder in File Explorer
- Right-click in the folder
- Select "Open in Terminal" or "Open PowerShell window here"

### Step 3: Install Dependencies

This will install Electron and Three.js:
```
npm install
```

Wait for it to finish (this may take a few minutes the first time).

### Step 4: Run the Application

Once installation is complete, type:
```
npm start
```

Press Enter. The IronFront application window should open!

## Troubleshooting

### "npm is not recognized"
- Node.js is not installed or not in PATH
- Reinstall Node.js and restart Command Prompt

### "Error: Cannot find module"
- Make sure you ran `npm install` first
- Delete the `node_modules` folder and run `npm install` again

### The window opens but is blank
- Wait a moment for the 3D world to load
- Click the window to lock your mouse cursor
- Try refreshing (Ctrl+R) or restarting

## Quick Reference Commands

```bash
# Navigate to project folder
cd C:\Users\xxred\Desktop\IronFront

# Install dependencies (first time only)
npm install

# Run the application
npm start
```


