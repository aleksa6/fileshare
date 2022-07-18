const lis = document.querySelectorAll("li");
const anchors = document.querySelectorAll("li a");

anchors.forEach((anchor) => {
  anchor.addEventListener("click", (ev) => {
    ev.preventDefault();
  });
});

lis.forEach((li) =>
  li.addEventListener("click", (ev) => {
    window.location.href =
      window.location.origin + li.children[0].getAttribute("href");
  })
);
