(function () {
  var v = document.getElementById('ytv');
  if (!v) return;
  v.addEventListener('click', function () {
    var f = document.createElement('iframe');
    f.src = 'https://www.youtube-nocookie.com/embed/' + v.getAttribute('data-id') + '?autoplay=1&rel=0';
    f.title = v.getAttribute('data-title');
    f.allow = 'accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen';
    f.setAttribute('allowfullscreen', '');
    f.referrerPolicy = 'strict-origin-when-cross-origin';
    v.parentNode.replaceChild(f, v);
  });
})();
