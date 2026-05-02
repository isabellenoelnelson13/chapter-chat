# Manual Test Cases — BookApp

**Test accounts needed:** Account A and Account B. Account A follows Account B (for social/feed tests).

---

## 1. Authentication

### 1.1 Sign up — success
1. Open the app for the first time (not logged in).
2. Tap "Don't have an account? Sign up".
3. Enter a unique username, a valid email, and a password (≥ 6 characters).
4. Tap "Create Account".
**Expected:** Redirected to the Home tab. No error shown.

### 1.2 Sign up — duplicate email
1. Attempt sign up with an email already registered.
**Expected:** Error message appears below the form. User remains on the sign-up screen.

### 1.3 Sign up — blank fields
1. Tap "Create Account" with one or more fields empty.
**Expected:** An error message is shown or the request fails gracefully — no crash.

### 1.4 Sign in — success
1. Open the app (not logged in).
2. Enter valid credentials and tap "Sign In".
**Expected:** Redirected to the Home tab.

### 1.5 Sign in — wrong password
1. Enter a valid email with an incorrect password.
2. Tap "Sign In".
**Expected:** Error message is shown. User stays on the login screen.

### 1.6 Sign in — unregistered email
1. Enter an email that has no account.
2. Tap "Sign In".
**Expected:** Error message is shown.

### 1.7 Navigate between login and signup
1. On the login screen, tap "Don't have an account? Sign up".
**Expected:** Sign-up screen opens.
2. Tap "Already have an account? Sign in".
**Expected:** Back on the login screen.

### 1.8 Sign out
1. Go to the Profile tab.
2. Tap "Sign Out".
**Expected:** Returned to the login screen. Navigating back does not reveal authenticated content.

### 1.9 Persisted session
1. Log in, then close and reopen the app.
**Expected:** App opens directly to the Home tab without requiring re-login.

---

## 2. Home Tab

### 2.1 Greeting changes by time of day
1. Open the Home tab.
**Expected:** Header shows "Good Morning" (before noon), "Good Afternoon" (noon–5 pm), or "Good Evening" (after 5 pm).

### 2.2 Date is shown correctly
**Expected:** Full date is displayed (e.g., "Saturday, April 11").

### 2.3 Empty state — no books on Reading shelf
**Setup:** Account has no books on the Reading shelf.
1. Open the Home tab.
**Expected:** A card showing "Start a book" / "Search for something to read" is visible. Tapping it navigates to Search.

### 2.4 Single book on Reading shelf
**Setup:** Exactly one book on the Reading shelf.
1. Open the Home tab.
**Expected:** A single book card shows cover (or placeholder), title, author, progress bar, page count, and percentage. A "Start Reading Session" button is visible. No carousel dots.

### 2.5 Progress bar reflects current page
**Setup:** Book has `current_page = 100`, `page_count = 200`.
**Expected:** Progress bar is roughly 50% full. Text reads "100 / 200 pages · 50%".

### 2.6 Carousel — multiple books on Reading shelf
**Setup:** Two or more books on the Reading shelf.
1. Open the Home tab.
**Expected:** A horizontal carousel shows one card at a time with pagination dots below. Swiping advances to the next card.

### 2.7 Start Reading Session button navigates to session screen
1. On the Home tab, tap "Start Reading Session" on a book card.
**Expected:** Navigates to the session screen for that book.

### 2.8 Today's Progress — pages and time
**Setup:** User has completed a reading session today.
1. Open the Home tab.
**Expected:** Pages read today and total time spent today are shown in the stats row.

### 2.9 Today's Progress — streak
**Expected:** Current reading streak (in days) is shown with a flame icon.

### 2.10 Today's Progress — zeroes on no activity
**Setup:** No sessions logged today.
**Expected:** Pages = 0, Time = 0m, Streak = actual current value.

### 2.11 Profile button navigates to Profile tab
1. Tap the person icon in the top-right corner of the Home tab.
**Expected:** Profile tab opens.

### 2.12 Home tab reloads on focus
1. Add a book to the Reading shelf (via Search or Library).
2. Navigate back to the Home tab.
**Expected:** The new book appears without a manual refresh.

---

## 3. Search

### 3.1 Opens with keyboard focused
1. Tap the + button in the Library header, or tap "Start a book" on the Home tab.
**Expected:** Search screen opens with the text input focused and keyboard visible.

### 3.2 Debounced search — results appear
1. Type a book title (e.g., "Hobbit").
2. Wait briefly.
**Expected:** A list of results appears showing cover image (or placeholder), title, author, and page count.

### 3.3 No results state
1. Type a nonsense string (e.g., "zzzzxxx").
**Expected:** No results are shown. No crash.

### 3.4 Clearing the query clears results
1. Type a query, see results.
2. Clear the text field.
**Expected:** Result list disappears.

### 3.5 Add book to a shelf — action sheet appears
1. Tap a search result.
**Expected:** An action sheet slides up with options: Reading, Want to Read, Read, Did Not Finish, and Cancel.

### 3.6 Add book — Reading shelf
1. Tap a result → select "Reading".
**Expected:** Search screen closes. The book appears in the Library under "Reading".

### 3.7 Add book — Want to Read shelf
1. Tap a result → select "Want to Read".
**Expected:** Book appears in Library under "Want to Read".

### 3.8 Cancel action sheet
1. Tap a result → tap "Cancel".
**Expected:** Action sheet closes. User stays on the search screen. Nothing is added.

### 3.9 Cancel button closes search
1. Tap the "Cancel" link next to the search field.
**Expected:** Search screen closes and returns to the previous screen.

---

## 4. Library

### 4.1 Default shelf is Reading
1. Open the Library tab.
**Expected:** The "Reading" pill is selected by default.

### 4.2 Shelf tabs switch correctly
1. Tap "Want to Read", then "Read", then "DNF".
**Expected:** Each tab loads the correct shelf contents. Active tab is visually highlighted.

### 4.3 Empty shelf state
1. Navigate to a shelf with no books.
**Expected:** "No books here yet" is displayed.

### 4.4 Book card shows title, author, cover
1. Navigate to a shelf with books.
**Expected:** Each book shows its cover (or a placeholder), title, and author.

### 4.5 Reading shelf shows progress bar
1. Open the Reading shelf. A book has a known page count and current page.
**Expected:** A progress bar and "X% complete" label are shown on each card.

### 4.6 Read shelf shows star rating
1. Open the Read shelf. A book has a rating set.
**Expected:** Filled and empty stars are shown reflecting the rating (e.g., ★★★★☆).

### 4.7 Tapping a book opens Book Detail
1. Tap any book in the Library.
**Expected:** Navigates to the Book Detail screen for that book.

### 4.8 + button opens Search
1. Tap the + (FAB) button in the Library header.
**Expected:** Search screen opens.

---

## 5. Book Detail

### 5.1 Shows title, author, cover, page count
1. Open a book detail screen.
**Expected:** Title, author, and page count are displayed. Cover image loads (or placeholder shown).

### 5.2 Description expand/collapse
1. If a description is shown and truncated, tap "Show more".
**Expected:** Full description expands. "Show less" appears. Tapping "Show less" collapses it.

### 5.3 "Start Reading Session" only on Reading shelf
1. Open a book on the Reading shelf.
**Expected:** "Start Reading Session" button is visible.
2. Open a book on the Read shelf.
**Expected:** "Start Reading Session" button is NOT shown.

### 5.4 "Start Reading Session" navigates to session screen
1. Tap "Start Reading Session".
**Expected:** Session screen opens for that book.

### 5.5 Star rating only on Read shelf
1. Open a book on the Read shelf.
**Expected:** 5 stars are shown (filled/empty based on current rating).
2. Open a book on the Reading shelf.
**Expected:** Stars are NOT shown.

### 5.6 Rating updates on star tap
1. On a Read-shelf book, tap star 4.
**Expected:** Stars update immediately (optimistic). Rating is saved (persists after leaving and returning).

### 5.7 Move to shelf action sheet
1. Tap "Move to shelf".
**Expected:** Action sheet with options: Reading, Want to Read, Read, Did Not Finish, Cancel.

### 5.8 Move to shelf navigates back
1. Tap "Move to shelf" and select any shelf.
**Expected:** Navigates back. The book appears on the newly selected shelf in the Library.

### 5.9 "Share progress" only on Reading shelf
1. Open a book on the Reading shelf.
**Expected:** "Share progress" button is visible.
2. Open a book on the Want shelf.
**Expected:** "Share progress" button is NOT visible.

### 5.10 "Share progress" button feedback
1. Tap "Share progress".
**Expected:** Button label changes to "Shared ✓" for ~2 seconds, then reverts.

### 5.11 Back button returns to previous screen
1. Open Book Detail from the Library. Tap Back.
**Expected:** Returns to Library. Active shelf is still correct.

---

## 6. Timed Reading Session

### 6.1 Setup phase shows starting page and Start Reading
1. Open the session screen for a book with a known current page.
**Expected:** "Starting page" input is pre-filled with the current page. "Start Reading" button and "Log manually instead" link are visible. Timer shows 0:00.

### 6.2 Timer starts on "Start Reading"
1. Tap "Start Reading".
**Expected:** Timer begins counting up from 0:00. "Pause" and "Finish" buttons appear.

### 6.3 Timer increments every second
1. Let the timer run for several seconds.
**Expected:** Timer increments by 1 each second.

### 6.4 Pause freezes the timer
1. While the timer is running, tap "Pause".
**Expected:** Timer stops. "Resume" and "Finish" buttons appear.

### 6.5 Resume continues from where it paused
1. Pause at 0:05. Wait a few seconds. Tap "Resume".
**Expected:** Timer continues from 0:05.

### 6.6 Finish shows ending page input
1. Tap "Finish".
**Expected:** "Ending page" input and "Save Session" button appear. "Share to feed" toggle appears (default off).

### 6.7 Save session with valid input
1. Enter a valid ending page (greater than start page, ≤ page count).
2. Tap "Save Session".
**Expected:** Returns to Book Detail. Session is saved (visible in Stats).

### 6.8 Validation — end page ≤ start page
1. Enter an ending page equal to or less than the starting page.
2. Tap "Save Session".
**Expected:** Error message: "Check your page numbers". Session is not saved.

### 6.9 Validation — end page exceeds book length
1. Enter an ending page greater than the book's page count.
2. Tap "Save Session".
**Expected:** Error message. Session is not saved.

### 6.10 Validation — zero timer
1. Tap Finish immediately (0 seconds elapsed). Enter a valid ending page. Tap Save Session.
**Expected:** Error: "Read at least a moment before saving".

### 6.11 "Log manually instead" navigates to manual log
1. In the setup phase, tap "Log manually instead".
**Expected:** Manual session log screen opens.

### 6.12 Share to feed — toggle on → creates event
1. In the finish phase, turn on "Share to feed".
2. Enter a valid ending page and save.
**Expected:** A `shared_session` event appears in followers' feeds.

### 6.13 Share to feed — toggle off → no event
1. Leave the toggle off and save the session.
**Expected:** No new event appears in followers' feeds.

---

## 7. Manual Session Log

### 7.1 Shows books on the Reading shelf
1. Open the manual log screen.
**Expected:** "Log a Session" heading. If one book is on the Reading shelf, it's shown. If multiple, a horizontal chip row lets you select.

### 7.2 No books message
**Setup:** Reading shelf is empty.
1. Open the manual log screen.
**Expected:** "No books currently being read" is shown.

### 7.3 Multi-book chip selection
**Setup:** Two or more books on the Reading shelf.
1. Tap a chip for the second book.
**Expected:** The selected book title updates. Start page pre-fills to that book's current page.

### 7.4 Save valid session
1. Fill in start page (e.g., 50), end page (e.g., 80), time (e.g., 1:30).
2. Tap "Log Session".
**Expected:** Returns to previous screen. Session is saved (shows in Stats).

### 7.5 Validation — end ≤ start
1. Set end page ≤ start page. Tap "Log Session".
**Expected:** Error: "End page must be greater than start page".

### 7.6 Validation — invalid time format
1. Enter time as "90" (no colon). Tap "Log Session".
**Expected:** Error: "Enter time as H:MM or HH:MM".

### 7.7 Validation — time of zero
1. Enter time as "0:00". Tap "Log Session".
**Expected:** Error: "Time must be greater than 0".

### 7.8 Back button exits without saving
1. Tap the back button without filling in any fields.
**Expected:** Returns to the previous screen. No session is saved.

---

## 8. Stats Tab

### 8.1 Streak and pages/day are shown
1. Open the Stats tab.
**Expected:** "Day streak" and "Pages/day avg" cards are visible with numeric values.

### 8.2 Yearly goal — not set
**Setup:** No yearly goal set in Profile.
**Expected:** "Set a goal in your Profile" message is shown in the goal card.

### 8.3 Yearly goal — set and progressing
**Setup:** Yearly goal is set (e.g., 12 books). Some books are on the Read shelf.
**Expected:** "X of 12 books" and a filled progress bar.

### 8.4 Last 30 Days line chart — no data
**Setup:** No sessions in the last 30 days.
**Expected:** "Start a reading session to see your history" message.

### 8.5 Last 30 Days line chart — with data
**Setup:** Sessions have been logged recently.
**Expected:** A line chart renders with data points and dates on the x-axis.

### 8.6 Books Finished bar chart — no data
**Setup:** No books finished this year.
**Expected:** "No books finished yet this year" message.

### 8.7 Books Finished bar chart — with data
**Setup:** At least one book on the Read shelf this year.
**Expected:** Bar chart renders with monthly bars.

### 8.8 Genres pie chart — no data
**Setup:** No books on the Read shelf with genre information.
**Expected:** "Finish books to see your genre breakdown" message.

### 8.9 Genres pie chart — with data
**Setup:** Multiple read books with different genres.
**Expected:** Donut pie chart renders with a legend showing genre names and counts.

### 8.10 Stats reload on focus
1. Complete a reading session.
2. Navigate to the Stats tab.
**Expected:** Updated data is shown without manual refresh.

---

## 9. Profile Tab

### 9.1 Username, initial, and bio are shown
1. Open the Profile tab.
**Expected:** Username is shown. The avatar displays the first letter of the username. Bio is shown if set.

### 9.2 Stats summary — books read, streak, pages this year
**Expected:** Three stat cards showing total books read, current streak, and pages read this year.

### 9.3 Yearly goal — tap to set
1. Tap the yearly goal card.
2. Enter a number (e.g., 15) in the prompt.
**Expected:** Goal updates immediately. Progress bar reflects the new goal.

### 9.4 Yearly goal progress bar
**Setup:** Goal is set to 12, 3 books have been read.
**Expected:** Progress bar is ~25% full. Text reads "3 of 12 books".

### 9.5 Shelf count pills navigate to Library
1. Tap any shelf pill (e.g., "Reading · 2").
**Expected:** Library tab opens.

### 9.6 Public profile switch — default on
**Setup:** Account is public (is_private = false).
**Expected:** "Public profile" switch is ON.

### 9.7 Toggle profile to private
1. Turn the "Public profile" switch OFF.
**Expected:** Profile is now private. Other users who don't follow you see the lock icon on your user profile page.

### 9.8 Toggle profile back to public
1. Turn the switch back ON.
**Expected:** Profile becomes public again.

### 9.9 Follow requests card — hidden when none
**Setup:** No pending follow requests.
**Expected:** "Follow Requests" section is NOT shown.

### 9.10 Follow requests card — shown with count
**Setup:** Another account has sent a follow request to this account (which is private).
**Expected:** "Follow Requests" card appears at the top of the profile with the requester's username.

### 9.11 Accept follow request
1. Tap "Accept" on a follow request.
**Expected:** Request disappears from the list. The requester can now see this account's shelf and activity.

### 9.12 Decline follow request
1. Tap "Decline" on a follow request.
**Expected:** Request disappears. The requester remains not following.

### 9.13 Sign Out
1. Tap "Sign Out".
**Expected:** Returns to the login screen.

---

## 10. Social Tab — People

### 10.1 Search bar is visible
1. Open the Social tab.
**Expected:** A search bar with "Search people..." placeholder is visible.

### 10.2 Following list — empty state
**Setup:** Not following anyone.
**Expected:** "Search for people to follow." is shown.

### 10.3 Following list — shows followed users
**Setup:** Following at least one user.
**Expected:** Followed users appear with avatar initial, username, bio, and a "Following" button.

### 10.4 Search — results appear
1. Type part of another user's username.
**Expected:** Matching users appear (debounced, ~300 ms). Each has a Follow button.

### 10.5 Search — no results
1. Type a string that matches no username.
**Expected:** "No users found" is shown.

### 10.6 Search mode hides Following list and Activity
1. Start typing in the search bar.
**Expected:** The Following list and Activity section disappear. Only search results are shown.

### 10.7 Clearing search restores default view
1. Clear the search input.
**Expected:** Following list and Activity section reappear.

### 10.8 Follow a public user
1. In search results, tap "Follow" on a public user.
**Expected:** Button changes to "Following" immediately (optimistic). The user appears in the Following list next time the tab loads.

### 10.9 Follow a private user
1. Tap "Follow" on a private user.
**Expected:** Button changes to "Requested" immediately.

### 10.10 Unfollow a user
1. Tap "Following" on a user you follow.
**Expected:** Button reverts to "Follow". User is removed from the following list on next load.

### 10.11 Cancel a follow request
1. Tap "Requested" on a user with a pending request.
**Expected:** Button reverts to "Follow". Request is cancelled.

### 10.12 Tapping a user row navigates to their profile
1. Tap the user row (not the follow button).
**Expected:** Navigates to the User Profile screen for that user.

---

## 11. User Profile Screen

### 11.1 Shows username, initial avatar, bio
1. Navigate to another user's profile.
**Expected:** Username, first-letter avatar, and bio are shown.

### 11.2 Follow button shown with correct label
- Not following, public user → "Follow" (filled button)
- Not following, private user → "Follow" (filled button)
- Request sent → "Requested" (outlined)
- Already following → "Following" (outlined)

### 11.3 Shelf counts visible for public profile
1. Open a public user's profile.
**Expected:** Read, Reading, Want, DNF counts are shown as pills.

### 11.4 Private profile locked — not following
1. Open a private user's profile (not following).
**Expected:** "🔒 Private profile" is shown. No shelf counts.

### 11.5 Private profile unlocked — following
1. Open a private user's profile while following them.
**Expected:** Shelf counts are shown.

### 11.6 Follow from user profile screen
1. Tap "Follow" on a public user's profile.
**Expected:** Button changes to "Following" immediately.

### 11.7 Unfollow from user profile screen
1. Tap "Following".
**Expected:** Reverts to "Follow".

---

## 12. Activity Feed

### 12.1 Empty state
**Setup:** Account A follows no one (or followees have no events).
1. Open the Social tab → Activity section.
**Expected:** "Follow people to see their activity here."

### 12.2 Feed loads on focus
**Setup:** Account A follows Account B. Account B has events.
1. Switch away from and back to the Social tab.
**Expected:** Feed reloads and shows B's events.

### 12.3 Pull-to-refresh
1. Pull down on the Social tab.
**Expected:** Spinner appears, feed reloads, spinner disappears.

### 12.4 Feed card — started_book
**Setup:** Account B moves a book to Reading.
**Expected:** "[B] is now reading [title]".

### 12.5 Feed card — finished_book with snippet
**Setup:** Account B moves a book to Read; review is set.
**Expected:** "[B] finished [title]". Review snippet shown (≤ 200 chars).

### 12.6 Feed card — added_to_shelf (want)
**Expected:** "[B] added to want to read list [title]".

### 12.7 Feed card — added_to_shelf (dnf)
**Expected:** "[B] added to did not finish list [title]".

### 12.8 Feed card — shared_session
**Setup:** Account B shares a session (N pages).
**Expected:** "[B] read [N] pages of [title]".

### 12.9 Feed card tap navigates to book detail
1. Tap a feed card body.
**Expected:** Book Detail screen opens.

### 12.10 Like an event
1. Tap the outline heart on a feed card.
**Expected:** Heart fills immediately. Count increments.

### 12.11 Unlike an event
1. Tap the filled heart.
**Expected:** Heart returns to outline. Count decrements.

### 12.12 Like persists after reload
1. Like an event. Pull to refresh.
**Expected:** Heart remains filled.

### 12.13 Comments modal opens
1. Tap the comment bubble on a feed card.
**Expected:** Bottom sheet modal slides up titled "Comments".

### 12.14 Comments empty state
**Expected:** "No comments yet. Be the first."

### 12.15 Post a comment
1. Type a message. Tap Send.
**Expected:** Comment appears immediately. Input clears.

### 12.16 Close comments modal
1. Tap ×.
**Expected:** Modal dismisses.

---

## 13. Share to Feed — Session & Book Detail

### 13.1 Share toggle hidden outside finish phase
**Expected:** Toggle is not visible during setup, running, or paused phases.

### 13.2 Share toggle in finish phase — default off
1. Tap Finish on a running session.
**Expected:** "Share to feed" row with Switch appears, default off.

### 13.3 Save with toggle on → creates feed event
1. Turn toggle on. Enter ending page. Save.
**Expected:** Followers see "[username] read [N] pages of [title]".

### 13.4 Save with toggle off → no event
1. Leave toggle off. Save.
**Expected:** No activity event created.

### 13.5 Share progress button (book detail) — visible only on Reading shelf
- Reading shelf → "Share progress" button visible.
- Read / Want / DNF shelf → button NOT visible.

### 13.6 Share progress → creates event + button feedback
1. Tap "Share progress".
**Expected:** Button shows "Shared ✓" for ~2 seconds, then reverts. Followers see the event.

---

## 14. Cross-Cutting

### 14.1 Unauthenticated access is blocked
1. Log out.
2. Attempt to navigate directly to a tab URL.
**Expected:** Redirected to the login screen.

### 14.2 Network error handling
1. Disable network access. Attempt to search for a book or load the feed.
**Expected:** App does not crash. Either an error is shown or a loading state persists gracefully.

### 14.3 Long book titles and usernames don't break layout
1. Add a book with a very long title. View it in Library, Home, and Book Detail.
**Expected:** Text truncates or wraps cleanly. No layout overflow.

### 14.4 Tab navigation persists state
1. Navigate to the Library, select the "Read" shelf.
2. Switch to another tab and back.
**Expected:** Library is still on the "Read" shelf (or reasonably close — acceptable if it resets to Reading on re-focus).

### 14.5 Back navigation is consistent
1. From any detail screen (Book Detail, User Profile, Session), tap Back.
**Expected:** Returns to the correct previous screen. Does not exit the app.

### 14.6 Discover tab placeholder
1. Open the Discover tab.
**Expected:** "Discover" title and "Coming in Phase 4" message. No crash.
