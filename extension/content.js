// Content script for Canvas LMS pages
// Detects course pages and extracts course ID from URL

(function () {
  const url = window.location.href;

  // Match Canvas course URLs like /courses/12345
  const courseMatch = url.match(/\/courses\/(\d+)/);
  if (!courseMatch) return;

  const courseId = courseMatch[1];
  const domain = window.location.hostname;

  // Try to extract page/assignment info from URL
  let itemType = null;
  let itemId = null;
  let pageUrl = null;

  // /courses/123/pages/page-slug
  const pageMatch = url.match(/\/courses\/\d+\/pages\/([^?#/]+)/);
  if (pageMatch) {
    itemType = "Page";
    pageUrl = pageMatch[1];
  }

  // /courses/123/assignments/456
  const assignmentMatch = url.match(/\/courses\/\d+\/assignments\/(\d+)/);
  if (assignmentMatch) {
    itemType = "Assignment";
    itemId = assignmentMatch[1];
  }

  // /courses/123/discussion_topics/456
  const discussionMatch = url.match(
    /\/courses\/\d+\/discussion_topics\/(\d+)/
  );
  if (discussionMatch) {
    itemType = "Discussion";
    itemId = discussionMatch[1];
  }

  // /courses/123/quizzes/456
  const quizMatch = url.match(/\/courses\/\d+\/quizzes\/(\d+)/);
  if (quizMatch) {
    itemType = "Quiz";
    itemId = quizMatch[1];
  }

  // Send info to background script
  chrome.runtime.sendMessage({
    type: "CANVAS_PAGE_DETECTED",
    data: {
      domain,
      courseId,
      itemType,
      itemId,
      pageUrl,
      url,
      title: document.title,
    },
  });

  // Inject a floating button to open the tutor
  const btn = document.createElement("button");
  btn.id = "studyvoice-fab";
  btn.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" x2="12" y1="19" y2="22"/>
    </svg>
  `;
  btn.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: #4ade80;
    color: #0a0a0f;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 99999;
    transition: transform 0.2s;
  `;
  btn.addEventListener("mouseenter", () => {
    btn.style.transform = "scale(1.1)";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.transform = "scale(1)";
  });
  btn.addEventListener("click", () => {
    chrome.runtime.sendMessage({
      type: "OPEN_SIDE_PANEL",
      data: {
        domain,
        courseId,
        itemType,
        itemId,
        pageUrl,
      },
    });
  });
  document.body.appendChild(btn);
})();
