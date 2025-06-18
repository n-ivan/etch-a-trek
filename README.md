# Etch-a-Trek

Transform your GPS route data into minimalist line art. Etch-a-Trek is a web-based application that converts various GPS data formats into visualizations without requiring maps or external services.

## Features

- **Multiple GPS formats supported**: GPX files, Google Maps polylines, JSON arrays, CSV files, and Google Maps URLs
- **Pure client-side processing**: No server required - runs entirely in your browser
- **Artistic line art output**: Creates clean, minimalist visualizations of your routes
- **Multiple activities**: Load and visualize multiple routes simultaneously
- **Interactive controls**: Select/deselect activities, adjust canvas size and line width
- **High-resolution export**: Download your artwork as PNG images
- **Responsive design**: Works on desktop and mobile devices

## Supported Data Formats

### GPX Files
Standard GPS Exchange Format files containing track points.

### Encoded Polylines
Google Maps encoded polyline strings (e.g., `_p~iF~ps|U_ulLnnqC_mqNvxq`@`)

### JSON Arrays
Coordinate arrays in various formats:
```json
[[lat,lng],[lat,lng],...]
[{"lat":40.7128,"lon":-74.0060},...]
[{"latitude":40.7128,"longitude":-74.0060},...]
```

### CSV Files
Comma-separated values with latitude,longitude per line:
```
40.7128,-74.0060
40.7589,-73.9851
```

## License

See the LICENSE file for license information.