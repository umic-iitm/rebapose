# REBAShotSelection User Manual

## 1. Getting Started

Open the app in your browser. You will see the **Sign In** screen with three user profiles.

### Users

| User | Name | Role |
|------|------|------|
| Reviewer 1 | Reviewer 1 | Can mark photos for deletion |
| Reviewer 2 | Reviewer 2 | Can mark photos for deletion |
| Admin | Admin | View-only, can download CSV export |

Your password has been shared with you separately by the admin.

### How to Sign In

1. Click your name to select it (a blue border appears)
2. Type your password
3. Click **Sign In**

If the password is wrong, a red error message appears. Fix the password and try again.

---

## 2. Review Grid

After login, you land on the main review grid. The screen is split into two panels:

- **Left panel** — scrollable grid of thumbnails
- **Right panel** — preview of the currently focused frame

### Orientation Tabs

The toolbar shows two orientation tabs:

| Tab | Shows |
|-----|-------|
| **Landscape (2755)** | All landscape-orientation frames (default) |
| **Portrait (1268)** | All portrait-orientation frames |

Each tab displays frames from videos of that orientation only, ensuring a clean, uniform grid. All stats (deletion counts, agreements, conflicts) remain global across all 4023 frames regardless of which tab is selected.

### Toolbar (top bar)

From left to right:

- **REBAShotSelection** — app name
- **Landscape / Portrait** — orientation tabs with frame counts
- **Showing: N of 4023** — number of photos currently displayed
- **Reviewer 1: N** — Reviewer 1's total deletion count (red)
- **Reviewer 2: N** — Reviewer 2's total deletion count (orange)
- **Agree: N** — photos both reviewers agree to delete (green)
- **Conflicts: N** — photos where only one reviewer wants to delete (yellow)
- **Grid size** slider — drag left for smaller thumbnails, right for larger
- **Review Marked** — toggle to show only your marked deletions (reviewers only)
- **Download CSV** — export all data (admin only)
- **Consensus** — opens the consensus dashboard
- **Avatar x** — click x to log out

### Preview Panel (right side)

The preview panel always shows the currently focused frame in full detail:

- Large image view with proper aspect ratio
- Filename and frame position (e.g., "Frame 148 of 2755")
- Both reviewers' deletion status (R1 = Reviewer 1, R2 = Reviewer 2)
- **X - Delete** and **U - Undo** buttons (reviewers only)

The preview updates instantly as you navigate with arrow keys or hover over thumbnails.

### Marking Photos for Deletion (Reviewers Only)

**Single photo:** Click a photo to toggle its deletion mark. A red **X** badge appears on the top-right corner when marked.

**Keyboard shortcuts:**

| Key | Action |
|-----|--------|
| Arrow keys (left/right/up/down) | Move focus through the grid |
| **X** | Mark focused photo for deletion |
| **U** | Undo deletion on focused photo |
| **Enter** | Open focused photo in lightbox (full-screen) |
| **Escape** | Clear selection |

**Mouse:** Hover over any thumbnail to focus it and see it in the preview panel.

### Understanding the Badges

- **Red X** (top-right) = you marked this photo for deletion
- **Orange circle with initial** (top-left) = the other reviewer marked this for deletion
- Both badges can appear on the same photo (both reviewers agree)

### Batch Selection (Reviewers Only)

Select multiple photos at once:

- **Ctrl + Click** — add/remove individual photos to selection (blue highlight)
- **Shift + Click** — select a range from your last click to the current one

When photos are selected, a blue action bar appears:

| Button | Action |
|--------|--------|
| **Mark for Deletion** | Marks all selected photos for deletion |
| **Unmark** | Removes deletion marks from all selected photos |
| **Cancel** | Clears the selection without making changes |

Press **Escape** to clear the selection.

### Filter Tabs

Below the toolbar, filter tabs narrow the grid within the current orientation:

| Tab | Shows |
|-----|-------|
| **All** | Every photo in the current orientation (default) |
| **Unreviewed** | Photos neither reviewer has marked |
| **My Deletes** | Photos you have marked for deletion |
| **Conflicts** | Photos where only one reviewer marked delete |
| **Both Deleted** | Photos both reviewers agree to delete |

For Admin, "My Deletes" appears as **Any Deleted** (photos marked by either reviewer).

### Grid Size

Use the slider in the toolbar to change thumbnail size. Drag left for smaller thumbnails (more per row), right for larger.

---

## 3. Lightbox View

Press **Enter** on a focused photo to see it full-screen.

### Lightbox Controls

| Control | Action |
|---------|--------|
| Left/Right arrow keys | Previous / next photo |
| X key | Toggle deletion mark (reviewers only) |
| Escape | Close lightbox, return to grid |
| On-screen arrow buttons | Navigate left/right |
| Mark for Deletion button | Toggle deletion (reviewers only) |
| x button (top-right) | Close lightbox |

The lightbox shows:
- Full-size image
- Filename and position (e.g., "3 of 2755")
- Red "MARKED FOR DELETION" text if you marked it
- Orange text if the other reviewer marked it

---

## 4. Consensus Dashboard

Click **Consensus** in the toolbar to see how the two reviewers' decisions compare.

### Overview Cards (top row)

- **Left card** — Reviewer 1's total deletions and percentage
- **Center card** — Agreement count, conflict count, untouched count
- **Right card** — Reviewer 2's total deletions and percentage

### Tabs

| Tab | Content |
|-----|---------|
| **Summary** | Progress bars for: both agree, only R1 deletes, only R2 deletes, kept by both |
| **Conflicts (N)** | List of photos where reviewers disagree, with Delete/Keep buttons (reviewers only) |
| **Both Deleted (N)** | Thumbnail grid of photos both agree to remove |

Click **← Grid** to return to the review grid.

---

## 5. Admin Features

Admin can see everything but cannot modify anything.

### What Admin CAN Do
- View the photo grid with both reviewers' deletion badges (R1 = Reviewer 1, R2 = Reviewer 2)
- Open the lightbox to inspect any photo (no delete button shown)
- Use filter tabs including **Any Deleted** (replaces "My Deletes")
- Navigate the consensus dashboard
- **Download CSV** — the purple button in the toolbar and on the consensus page

### What Admin CANNOT Do
- Mark or unmark photos for deletion
- Use batch selection
- Use the "Review Marked" toggle

### CSV Export

Click **Download CSV** to download a file named `rebashotselection-export-YYYY-MM-DD.csv` containing:

```
photo_id,filename,reviewer1_delete,reviewer2_delete
0,1_VID_20231026_123736025__f000134__t001.jpg,false,false
1,1_VID_20231026_123736025__f000249__t001.jpg,true,false
5,1_VID_20231026_123736025__f000832__t002.jpg,true,true
...
```

Every photo is included regardless of orientation tab. Use the `reviewer1_delete` and `reviewer2_delete` columns to decide which photos to remove using your deletion script.

---

## 6. Keyboard Shortcut Reference

### Grid View

| Key | Action |
|-----|--------|
| Left/Right/Up/Down | Move focus through grid |
| X | Mark for deletion |
| U | Undo deletion |
| Enter | Open lightbox on focused photo |
| Escape | Clear selection (if any) |
| Ctrl + Click | Add/remove from multi-selection |
| Shift + Click | Range select |

### Lightbox View

| Key | Action |
|-----|--------|
| Left/Right arrow | Previous / next photo |
| X | Toggle delete |
| Escape | Close lightbox |

---

## 7. Recommended Workflow

1. Start with the **Landscape** tab (larger set, 2755 frames)
2. Use **arrow keys** to navigate through frames — the preview panel shows each frame in detail
3. Press **X** to mark poor frames for deletion, **U** to undo mistakes
4. Use **Enter** for full-screen lightbox when you need more detail on a frame
5. Switch to **Portrait** tab and repeat
6. Check **Conflicts** filter regularly to see where you and the other reviewer disagree
7. Visit the **Consensus Dashboard** to track overall progress
8. All changes are **saved automatically** to the database — refreshing the page or closing the browser will not lose your work
