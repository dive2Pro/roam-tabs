# Roam Tabs

Manage your working pages with tabs.

## Stack Mode 🥳

[![image](https://github.com/dive2Pro/roam-tabs/blob/5f022018885a8fd08138779e9a5b7fc1cf9e8df7/asserts/stackmode.png)](https://github.com/user-attachments/assets/e2921c49-a6f7-484f-8ccf-41af1975848d)

Stack Mode is an alternative display mode for tabs that provides a unique visual experience. Instead of the traditional horizontal tab bar, pages are displayed in a stacked layout with horizontal scrolling.

### Features

- **Stacked Layout**: Pages are displayed side-by-side in a horizontal scrollable container, with each page showing a vertical spine (edge) that displays the page title
- **Visual Stacking**: Pages overlap each other, creating a visual stack effect where you can see multiple pages at once
- **Spine Navigation**: Click on the vertical spine (edge) of any page to focus and scroll to that page
- **Horizontal Scrolling**: Scroll horizontally to navigate through your open tabs
- **Minimap Navigation**: A visual minimap appears at the bottom-right corner showing all open pages as blocks. The blue thumb indicates your current viewport position. You can drag the thumb or click anywhere on the minimap to quickly navigate to different positions. The minimap automatically hides when all pages fit within the viewport
- **Page Width Configuration**: Customize the width of each page in Stack Mode (default: 650px) through the extension settings

### How to Enable Stack Mode

1. Go to Extension Settings
2. Find "Tab Display Mode" option
3. Select "stack" from the dropdown
4. Alternatively, use the Command Palette and search for "Tabs: Change to Stack Mode"

### Using Stack Mode

- **Navigate**: Scroll horizontally or click on a page's spine to focus on it
- **Close Tabs**: Click the close button (×) on the spine of any page
- **Switch Pages**: Click on the spine or content area of a page to make it active
- **Minimap Navigation**:
  - The minimap displays at the bottom-right corner showing all your open pages as colored blocks
  - The blue thumb (slider) represents your current viewport position
  - **Drag the thumb** to scroll through pages smoothly
  - **Click anywhere on the minimap** to jump to that position instantly
  - The minimap automatically hides when all pages are visible (no scrolling needed)

Stack Mode is particularly useful when you want to see multiple pages at once and prefer a more visual, spatial way of managing your tabs.

<img width="767" alt="image" src="https://github.com/dive2Pro/roam-tabs/assets/23192045/8423abe5-8697-4b9e-949d-cd707711a4b6">

## Open Page In a New Tab

You can open a new tab by pressing Ctrl or the Meta key and clicking the link (page or block reference).

You can enable the "Auto" mode, after which just **clicking** will open a tab (if the page tab exists, it will focus on that tab).

<img width="688" alt="image" src="https://github.com/dive2Pro/roam-tabs/assets/23192045/08b26378-8358-43fa-8924-4ae6c23975bf">

## Switch Tab

![image](https://github.com/dive2Pro/roam-tabs/assets/23192045/820e8902-0532-4a6e-ab3b-4d1f2d4f123a)

You can open the switch palette by

1. Command Pallete
   ![image](https://github.com/dive2Pro/roam-tabs/assets/23192045/212bdf80-1c5c-4da3-b545-9db90b8a405d)

2. custom hotkeys
   ![image](https://github.com/dive2Pro/roam-tabs/assets/23192045/5fe48402-a157-490e-b408-3b57e35bbb25)

When the switch palette opens, the input text is automatically selected, so you can start typing immediately to search for tabs.

### Drag to Reorder Tabs in Switch Palette

You can reorder tabs directly in the switch palette by dragging the handle icon (⋮⋮) on the right side of each tab item. This allows you to:

- **Drag to Reorder**: Click and hold the drag handle (⋮⋮) on any tab item and drag it to a new position
- **Visual Feedback**: The dragged item will show visual feedback (highlighted background and reduced opacity)
- **Auto-scroll**: When dragging near the top or bottom of the list, the viewport will automatically scroll to help you reach items outside the visible area
- **Persistent Order**: The new order is saved and will be reflected in your tab bar

**Note**: The drag handle only appears when there's no search query active, allowing you to reorder tabs when browsing the full list.

## Open Tab in Sidebar

**Shift** + click on tabs

## Right-Click to Close Tab(s)

You can right-click on a tab to close it or other tabs

## Keyboard Shortcut for Closing the Current Tab

There are keyboard shortcuts available for closing tabs. You can set them up in the settings.

## Pin Tab

You have the option to pin tabs to keep them in order at the beginning and prevent accidental removal.

## Drag & Drop to rearrange the tabs

https://github.com/dive2Pro/roam-tabs/assets/23192045/806e9f37-076c-4f2c-bf34-1d1e0c0d0fd8

## Settings (Admin Only)

### Initial Tabs for Visitors

As an admin, you can configure initial tabs that will be shown to visitors and collaborators when they first open the workspace. This feature allows you to:

- Search and select pages from your Roam database
- Set up a default set of tabs for new users
- Manage the initial tabs list through a multi-select interface

To configure initial tabs:

1. Go to Extension Settings
2. Find "Initial Tabs for Visitors" section
3. Use the search box to find and select pages
4. Selected pages will appear as tags that can be removed individually
5. Click the clear button (×) to remove all selections

### Collaborator Tabs

When enabled, this option allows collaborators to save their personal tab state to browser local storage. Their tab configuration will be restored after page refresh, providing a personalized experience while still respecting the initial tabs set by admins.
