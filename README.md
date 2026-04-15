# EWUMart Project Structure and Architecture

This file provides a comprehensive step-by-step breakdown of every file inside the `execution/` directory for EWUMart and explains its specific purpose within the application.

## 📁 Root Level

### `server.py`
**Purpose**: The central Python backend server running on Flask.
**Details**: It acts as both the Backend REST API (handles login, database commits, data retrieval endpoint) and a static file server to deliver `index.html` to the browser. It integrates directly with a SQLite database (`ewumart.db`).

### `index.html`
**Purpose**: The main skeleton for the Single Page Application (SPA).
**Details**: Contains the structure for the entire frontend (Auth screens, Dashboard, Settings, etc.). Instead of multiple HTML pages, the application hides and shows sections here based on user navigation.

### `ewumart.db`
**Purpose**: The SQLite Database file.
**Details**: Stores persistent data needed for EWUMart to function, such as: User profiles, Product listings, chat Messages, Transactions, Reviews, and admin Reports.

---

## 📁 CSS Layer (`css/`)

### `styles.css`
**Purpose**: The central stylesheet for formatting the website.
**Details**: Maps directly to the HTML to apply custom styling, layouts, variables (colors/themes), button designs, and view transitions. Since there's only one CSS file, all visual configurations exist here.

---

## 📁 JavaScript Core (`js/`)

### `app.js`
**Purpose**: The main application runner.
**Details**: This file executes when the HTML loads. It is responsible for initiating the routers, loading the core services (like APIs and databases), and bootstrapping the connection between HTML UI and your data. 

### `ApiService.js`
**Purpose**: The HTTP communication layer.
**Details**: Acts as the middleman between your Frontend Javascript and your Python `server.py`. Contains functions (like `fetch()`) tailored to easily get data from or post data to your `/api/...` endpoints.

### `Database.js`
**Purpose**: Local Data Manager. 
**Details**: This file typically manages the local memory/states representing the information you just fetched. If you've fetched a product, `Database.js` may keep it available for different tabs or controllers to safely access without redundant network calls.

### `Router.js`
**Purpose**: Frontend Navigation Manager.
**Details**: Because this is a Single Page Application, `Router.js` dictates which "screen" should be visible (like `#login` vs `#dash` vs `#market`) by analyzing URL hashes and showing/hiding specific `div` containers.

### `Toast.js`
**Purpose**: Alert Notification Handler.
**Details**: An isolated UI component that triggers tiny, non-intrusive popup alerts in the corner of the screen (e.g., "Logged in successfully", "Item posted", or error notifications).

### `Badge.js`
**Purpose**: Notification indicator element.
**Details**: Reusable UI component logic to display tiny red "unread" counts next to icons such as Messages or Notifications.

---

## 📁 JavaScript Controllers (`js/controllers/`)
*Controllers bind HTML user interactions (clicks, inputs) with the data layer directly.*

### `AuthController.js`
**Purpose**: Handles User Authentication.
**Details**: Intercepts the Login and Registration forms in `index.html`, manages credentials, and calls your API to actually log the student in. 

### `MarketController.js`
**Purpose**: Manages the Marketplace interface.
**Details**: Logic to fetch lists of items from the database, render product cards on the screen, handle product categories, and capture filtering/search bar interactions.

### `PostController.js`
**Purpose**: Handles the "Create Listing" functionally.
**Details**: Intercepts the form where the user tries to sell or request an item. It validates their inputs (price, title, condition) before shipping the data off to the server.

### `DashController.js`
**Purpose**: Powers the main user overview screen.
**Details**: Grabs high-level metrics for the logged-in user like their recent activities, account summary, and quick links to various dashboards. 

### `AdminController.js`
**Purpose**: Power-user moderation tools.
**Details**: Loads specifically for Admin accounts (managing flagged items or problematic users and looking at system reports).

### `MsgController.js`
**Purpose**: Manages the User-to-User chat functionalities.
**Details**: Loads messages, sends new messages between two students (e.g., buyer & seller), and ensures the UI updates to show latest messages.

### `Private/Minor Controllers`
* **`ProfileController.js`**: Handles logic for viewing / editing the logged-in user's profile and bio.
* **`PostListController.js`**: Reusable controller logic specifically useful for generating consistent lists of `Product` components on varying screens. 
* **`TxnController.js`**: Manages the flow and logic when an item goes from "Listed" -> "Pending Transaction" -> "Sold". 
* **`ReportController.js`**: Manages the logic for when a user flags a listing as inappropriate or spam. 
* **`ModalController.js`**: Specifically designed to orchestrate popping-up and closing generic overlay screens (Modals) where you need user focus on one thing (like a confirming delete action).
* **`NotifController.js`**: Fetches and renders system-level notifications for the user (alerts other than messages).
