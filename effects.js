// ===== パララックス：スクロールするとトップ画像がゆっくり動く =====
const heroImage = document.querySelector(".hero-image");

window.addEventListener("scroll", function() {
    let scrollY = window.scrollY;
    heroImage.style.transform = "translateY(" + scrollY * 0.3 + "px)";
});

// ===== フェードイン：画面に入った要素をふわっと表示する =====
const observer = new IntersectionObserver(function(entries) {
    // 同時に画面に入った要素は、少しずつずらして順番に表示する
    let count = 0;
    entries.forEach(function(entry) {
        if (entry.isIntersecting) {
            const target = entry.target;
            setTimeout(function() {
                target.classList.add("show");
            }, count * 100);
            count++;
            // 一度表示したら見張るのをやめる（何度もフェードしないように）
            observer.unobserve(target);
        }
    });
}, { threshold: 0.15 });

// 要素を見張る対象に追加する関数（timer.jsで作ったカードにも使う）
function watchFadeIn(element) {
    observer.observe(element);
}

// HTMLに最初からある .fade-in を見張る
document.querySelectorAll(".fade-in").forEach(function(element) {
    watchFadeIn(element);
});
