# Smart Heating System Frontend

This project provides a user-friendly web interface for the Smart Heating System, allowing users to monitor and control ESP32-based heating devices.

## Features

- **Real-time Dashboard**
  - Current temperature and humidity readings
  - Device control panel for setting desired temperature
  - Operating mode selection (Auto/Manual)
  - System status monitoring

- **Historical Data Visualization**
  - Interactive temperature and humidity charts
  - Sortable data table
  - Time range filtering for data analysis

- **Responsive Design**
  - Mobile-friendly interface
  - Clean, modern UI with Tailwind CSS

## Project Structure

```
/
├── index.html         # Dashboard page
├── historical.html    # Historical data page
├── js/
│   ├── app.js         # Dashboard functionality
│   └── historical.js  # Historical data functionality
```

## Setup Instructions

1. Clone the repository or download the files to your web server

2. Update the API URLs in the JavaScript files:
   - Open `js/app.js` and `js/historical.js`
   - Update the `API_BASE_URL` constant to match your backend server address
   - Update the `DEVICE_ID` constant if you have multiple devices

3. If deploying to a production environment, consider:
   - Using a CDN for Tailwind CSS and Chart.js
   - Minifying JavaScript files
   - Adding proper authentication mechanisms

## API Integration

This frontend is designed to work with the ESP32 backend API. It expects the following endpoints:

1. `GET /device-status?deviceId=DEVICE_ID` - Get current device status
2. `POST /device-control` - Update device settings
3. `GET /esp32-data` - Get historical sensor data

## Customization

### Adding More Devices

To support multiple devices:
- Update the device selector dropdown in the HTML
- Modify the JavaScript to handle device selection

### Extending the Dashboard

To add more widgets or cards:
1. Add HTML markup to `index.html` following the existing card patterns
2. Update the JavaScript to fetch and display required data
3. Style with Tailwind CSS classes for consistency

## Browser Compatibility

Tested and compatible with:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Dependencies

- [Tailwind CSS](https://tailwindcss.com/) - For styling
- [Chart.js](https://www.chartjs.org/) - For data visualization
- [Font Awesome](https://fontawesome.com/) - For icons

## License

This project is provided for educational purposes. Feel free to modify and use according to your needs.

## Credits

Designed and developed for the Smart Heating System project.