module.exports = {
  content: ["./**/*.{html,js}"],

  theme: {
    extend: {
      colors: {
        primary: '#804e69',
        'brand-purple': '#804e69',
            'brand-dark-purple': '#3f2739',
            'brand-magenta': '#895051',
            'brand-black': '#0c060f'
      
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.5s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}