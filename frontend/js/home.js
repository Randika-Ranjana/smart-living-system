// Home page banner slideshow
document.addEventListener('DOMContentLoaded', () => {
    const slides = [
        {
            title: "Smart Heating Solutions",
            subtitle: "Control your home temperature from anywhere",
            bgColor: "from-blue-500 to-blue-700"
        },
        {
            title: "Energy Efficient",
            subtitle: "Save money on your heating bills",
            bgColor: "from-green-500 to-green-700"
        },
        {
            title: "24/7 Monitoring",
            subtitle: "Always know your home's temperature",
            bgColor: "from-purple-500 to-purple-700"
        }
    ];

    let currentSlide = 0;
    const banner = document.getElementById('banner-slideshow');

    function changeSlide() {
        currentSlide = (currentSlide + 1) % slides.length;
        updateSlide();
    }

    function updateSlide() {
        const slide = slides[currentSlide];
        banner.className = `relative h-64 md:h-96 rounded-lg overflow-hidden shadow-lg`;
        banner.innerHTML = `
            <div class="absolute inset-0 bg-gradient-to-r ${slide.bgColor} flex items-center justify-center flex-col">
                <h2 class="text-3xl md:text-5xl font-bold text-white text-center px-4">${slide.title}</h2>
                <p class="text-xl md:text-2xl text-white mt-4">${slide.subtitle}</p>
            </div>
        `;
    }

    updateSlide();
    setInterval(changeSlide, 5000);
});