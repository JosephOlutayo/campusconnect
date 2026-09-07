/*
 * The small amount of behaviour the server cannot do on its own.
 *
 * Everything here is progressive: with JavaScript off the pages still render
 * and every form still submits, because they are real forms posting to real
 * endpoints. This file only removes friction.
 */

(function () {
  "use strict";

  /*
   * A fixed bottom bar anchors to the bottom of the *visual* viewport, so when
   * a phone keyboard opens the tab bar rides up with it and lands directly
   * under the field being typed into — where a tap meant for the input
   * navigates away instead. Hide it while the keyboard is up.
   */
  function trackKeyboard() {
    var viewport = window.visualViewport;
    var tabbar = document.querySelector(".tabbar");
    if (!viewport || !tabbar) return;

    viewport.addEventListener("resize", function () {
      // A keyboard takes roughly a third of the screen; a URL bar hiding takes
      // far less. A quarter sits comfortably between the two.
      var keyboardOpen = viewport.height < window.innerHeight * 0.75;
      tabbar.style.display = keyboardOpen ? "none" : "";
    });
  }

  /* Confirm anything destructive before the form posts. */
  function confirmDangerousForms() {
    document.addEventListener("submit", function (event) {
      var form = event.target;
      var message = form.getAttribute("data-confirm");
      if (message && !window.confirm(message)) {
        event.preventDefault();
      }
    });
  }

  /*
   * Submit-once. A double-click on a booking button is a genuine way to create
   * two appointments, and the server's lock will reject the second — but the
   * person should not have to see that error at all.
   */
  function guardDoubleSubmit() {
    document.addEventListener("submit", function (event) {
      var form = event.target;
      if (form.getAttribute("data-confirm") && event.defaultPrevented) return;
      var button = form.querySelector('button[type="submit"], button:not([type])');
      if (!button) return;
      setTimeout(function () {
        button.disabled = true;
        if (button.dataset.busy) button.textContent = button.dataset.busy;
      }, 0);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    trackKeyboard();
    confirmDangerousForms();
    guardDoubleSubmit();
  });
})();
