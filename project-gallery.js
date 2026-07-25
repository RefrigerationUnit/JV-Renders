document.querySelectorAll('.project-gallery').forEach(gallery => {
  const scrollArea = gallery.querySelector('.project-scroll');
  const previousButton = gallery.querySelector('.gallery-arrow--previous');
  const nextButton = gallery.querySelector('.gallery-arrow--next');

  function imageStep() {
    const firstImage = scrollArea.querySelector('img');
    if (!firstImage) return scrollArea.clientWidth;

    const styles = getComputedStyle(scrollArea);
    return firstImage.offsetWidth + parseFloat(styles.gap || 0);
  }

  function updateButtons() {
    const remainingScroll = scrollArea.scrollWidth - scrollArea.clientWidth - scrollArea.scrollLeft;
    previousButton.disabled = scrollArea.scrollLeft <= 1;
    nextButton.disabled = remainingScroll <= 1;
  }

  previousButton.addEventListener('click', () => {
    scrollArea.scrollBy({ left: -imageStep(), behavior: 'smooth' });
  });

  nextButton.addEventListener('click', () => {
    scrollArea.scrollBy({ left: imageStep(), behavior: 'smooth' });
  });

  scrollArea.addEventListener('scroll', updateButtons, { passive: true });
  addEventListener('resize', updateButtons, { passive: true });
  updateButtons();
});