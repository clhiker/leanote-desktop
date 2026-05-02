(function() {
  function debounce(fn, delay) {
    var timer = null;
    return function() {
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function() {
        fn.apply(null, args);
      }, delay);
    };
  }

  function escapeHtml(str) {
    return (str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function toSlug(text) {
    return (text || "")
      .toLowerCase()
      .replace(/[\s]+/g, "-")
      .replace(/[^\w\u4e00-\u9fa5\-]/g, "")
      .replace(/\-+/g, "-")
      .replace(/^\-+|\-+$/g, "");
  }

  var nodeRequire = window.requireNode || window.require;
  var MarkdownIt = nodeRequire("markdown-it");
  var markdownItEmoji = nodeRequire("markdown-it-emoji");
  var markdownItTaskLists = nodeRequire("markdown-it-task-lists");
  var markdownItFootnote = nodeRequire("markdown-it-footnote");
  var markdownItMark = nodeRequire("markdown-it-mark");
  var markdownItAnchor = nodeRequire("markdown-it-anchor");
  var twemoji = nodeRequire("twemoji");

  var md = new MarkdownIt({
    html: true,
    linkify: true,
    breaks: true,
    typographer: true
  });

  md.use(markdownItEmoji.full || markdownItEmoji);
  md.use(markdownItTaskLists, { enabled: true, label: true, labelAfter: true });
  md.use(markdownItFootnote);
  md.use(markdownItMark);
  md.use(markdownItAnchor, {
    permalink: false,
    slugify: toSlug
  });

  function ensureTextareaEditor() {
    var editor = document.getElementById("wmd-input");
    if (!editor) {
      return null;
    }
    if (editor.tagName.toLowerCase() === "textarea") {
      return editor;
    }

    var initial = "";
    var sub = document.getElementById("wmd-input-sub");
    if (sub) {
      initial = sub.textContent || "";
    }

    var ta = document.createElement("textarea");
    ta.id = "wmd-input";
    ta.className = editor.className;
    ta.value = initial;
    ta.setAttribute("tabindex", "2");
    editor.parentNode.replaceChild(ta, editor);
    return ta;
  }

  function renderMarkdown(content) {
    var html = md.render(content || "");
    try {
      html = twemoji.parse(html, { folder: "svg", ext: ".svg" });
    } catch (e) {}
    return html;
  }

  function buildToc() {
    var nav = document.getElementById("leanoteNavContentMd");
    var preview = document.getElementById("wmd-preview");
    if (!nav || !preview) {
      return;
    }

    var headings = preview.querySelectorAll("h1,h2,h3,h4,h5,h6");
    if (!headings.length) {
      nav.innerHTML = "&nbsp; &nbsp; Nothing...";
      return;
    }

    var html = [];
    for (var i = 0; i < headings.length; i++) {
      var h = headings[i];
      var level = parseInt(h.tagName.substring(1), 10);
      var text = h.textContent || "";
      if (!h.id) {
        h.id = "md-" + toSlug(text || String(i));
      }
      var indent = (level - 1) * 12;
      html.push(
        '<div style="padding-left:' + indent + 'px"><a href="#' +
          escapeHtml(h.id) +
          '">' +
          escapeHtml(text) +
          "</a></div>"
      );
    }
    nav.innerHTML = html.join("");
  }

  function setupPreviewAnchorScroll() {
    var nav = document.getElementById("leanoteNavContentMd");
    if (!nav) {
      return;
    }
    nav.addEventListener("click", function(e) {
      var target = e.target;
      if (!target || target.tagName.toLowerCase() !== "a") {
        return;
      }
      e.preventDefault();
      var id = target.getAttribute("href");
      if (!id || id.charAt(0) !== "#") {
        return;
      }
      var h = document.getElementById(id.slice(1));
      if (h && typeof h.scrollIntoView === "function") {
        h.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  function initModernMarkdown() {
    var input = ensureTextareaEditor();
    var preview = document.getElementById("wmd-preview");
    if (!input || !preview) {
      return;
    }

    var doRender = function() {
      preview.innerHTML = renderMarkdown(input.value);
      buildToc();
    };

    var debouncedRender = debounce(doRender, 120);
    input.addEventListener("input", debouncedRender);

    window.MD = window.MD || {};

    window.MD.focus = function() {
      input.focus();
    };

    window.MD.setContent = function(content) {
      input.value = content || "";
      doRender();
    };

    window.MD.getContent = function() {
      return input.value || "";
    };

    window.MD.onResize = function() {};
    window.MD.resize = function() {};
    window.MD.clearUndo = function() {};
    window.MD.toggleToAce = function() {};
    window.MD.toggleToLight = function() {};
    window.MD.setModeName = function() {};
    window.MD.changeAceKeyboardMode = function() {};

    window.MD.insertLink = function(link, text, isImage) {
      link = link || "";
      var start = input.selectionStart || 0;
      var end = input.selectionEnd || start;
      var selected = input.value.substring(start, end);
      var label = text || selected || (isImage ? "image" : "link");
      var inserted = isImage ? "![" + label + "](" + link + ")" : "[" + label + "](" + link + ")";
      input.setRangeText(inserted, start, end, "end");
      doRender();
      input.focus();
    };

    window.MarkdownEditor = {
      refreshPreview: doRender
    };

    setupPreviewAnchorScroll();
    doRender();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initModernMarkdown);
  } else {
    initModernMarkdown();
  }
})();
