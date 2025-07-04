// Themes configuration - simplified to single default theme
const DEFAULT_THEME = {
    background: '#ffffff',
    colour: 'black'
};

// Global variables
let activities = [];
let canvas = document.getElementById('canvas');
let ctx = canvas.getContext('2d');

// Sorting state
let currentSortColumn = null;
let currentSortDirection = 'asc';

// Local storage key for activities
const ACTIVITIES_STORAGE_KEY = 'etch-a-trek-activities';

// DOM elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const polylineText = document.getElementById('polylineText');
const canvasSizeSelect = document.getElementById('canvasSize');
const customSizeGroup = document.getElementById('customSizeGroup');
const customWidth = document.getElementById('customWidth');
const customHeight = document.getElementById('customHeight');
const lineWidthSlider = document.getElementById('lineWidth');
const lineWidthValue = document.getElementById('lineWidthValue');
const downloadBtn = document.getElementById('downloadBtn');
const clearBtn = document.getElementById('clearBtn');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const errorContainer = document.getElementById('errorContainer');
const statsContainer = document.getElementById('statsContainer');
const activitiesTable = document.getElementById('activitiesTable');
const activitiesTableBody = document.getElementById('activitiesTableBody');
const selectAllCheckbox = document.getElementById('selectAllCheckbox');
const activityTypeFilter = document.getElementById('activityTypeFilter');

// Local storage functions
function saveActivitiesToLocalStorage() {
    try {
        localStorage.setItem(ACTIVITIES_STORAGE_KEY, JSON.stringify(activities));
    } catch (error) {
        console.warn('Failed to save activities to local storage:', error);
    }
}

function loadActivitiesFromLocalStorage() {
    try {
        const stored = localStorage.getItem(ACTIVITIES_STORAGE_KEY);
        if (stored) {
            const loadedActivities = JSON.parse(stored);
            // Validate that loaded data is an array
            if (Array.isArray(loadedActivities)) {
                // Convert date strings back to Date objects and add missing fields
                activities = loadedActivities.map(activity => ({
                    ...activity,
                    date: activity.date ? new Date(activity.date) : null,
                    activityType: activity.activityType || 'Unknown'
                }));
                updateUI();
            }
        }
    } catch (error) {
        console.warn('Failed to load activities from local storage:', error);
    }
}

// Initialize
updateCanvasSize();
loadActivitiesFromLocalStorage();

// Add sorting event listeners to table headers
document.addEventListener('DOMContentLoaded', function() {
    const sortableHeaders = document.querySelectorAll('.sortable');
    sortableHeaders.forEach(header => {
        header.addEventListener('click', () => handleSort(header.dataset.column));
        header.style.cursor = 'pointer';
    });
});

// Event listeners
uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', handleDragOver);
uploadArea.addEventListener('drop', handleDrop);
fileInput.addEventListener('change', handleFileSelect);
polylineText.addEventListener('input', handleTextInput);
canvasSizeSelect.addEventListener('change', handleCanvasSizeChange);
lineWidthSlider.addEventListener('input', updateLineWidthValue);
downloadBtn.addEventListener('click', downloadImage);
clearBtn.addEventListener('click', clearAllActivities);
selectAllCheckbox.addEventListener('change', handleSelectAll);
activityTypeFilter.addEventListener('change', handleTypeFilter);

function handleDragOver(e) {
    e.preventDefault();
    uploadArea.classList.add('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files).filter(f => 
        f.name.endsWith('.gpx') || f.name.endsWith('.txt') || 
        f.name.endsWith('.json') || f.name.endsWith('.csv')
    );
    if (files.length > 0) {
        processFiles(files);
    }
}

function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    processFiles(files);
}

function handleTextInput() {
    const text = polylineText.value.trim();
    if (text) {
        try {
            const activity = parseRouteData(text);
            activity.enabled = true;
            activity.id = Date.now(); // Simple unique ID
            activities.push(activity);
            polylineText.value = ''; // Clear the text area
            saveActivitiesToLocalStorage();
            updateUI();
        } catch (error) {
            showError('Error parsing route data: ' + error.message);
        }
    }
}

function handleCanvasSizeChange() {
    if (canvasSizeSelect.value === 'custom') {
        customSizeGroup.style.display = 'block';
    } else {
        customSizeGroup.style.display = 'none';
        updateCanvasSize();
    }
    // Auto-generate when canvas size changes
    if (activities.filter(a => a.enabled).length > 0) {
        generateImage();
    }
}

function updateCanvasSize() {
    let width, height;
    
    if (canvasSizeSelect.value === 'custom') {
        width = parseInt(customWidth.value);
        height = parseInt(customHeight.value);
    } else {
        [width, height] = canvasSizeSelect.value.split('x').map(Number);
    }
    
    // Set the actual canvas size (this determines the image resolution)
    canvas.width = width;
    canvas.height = height;
    
    // Set the display size (this determines how big it appears on screen)
    // Scale down if the canvas is larger than the available space
    const maxDisplayWidth = 600;
    const maxDisplayHeight = 400;
    
    const scale = Math.min(
        maxDisplayWidth / width,
        maxDisplayHeight / height,
        1 // Don't scale up, only down
    );
    
    canvas.style.width = (width * scale) + 'px';
    canvas.style.height = (height * scale) + 'px';
}

function updateThemePreview() {
    // No longer needed - theme selector removed
}

function updateLineWidthValue() {
    lineWidthValue.textContent = lineWidthSlider.value;
    // Auto-generate when line width changes
    if (activities.filter(a => a.enabled).length > 0) {
        generateImage();
    }
}

async function processFiles(files) {
    showProgress(0);
    const newActivities = [];
    
    for (let i = 0; i < files.length; i++) {
        try {
            const text = await readFileAsText(files[i]);
            const activity = parseRouteData(text);
            activity.name = files[i].name;
            activity.enabled = true;
            activity.id = Date.now() + i; // Simple unique ID
            newActivities.push(activity);
            showProgress((i + 1) / files.length * 100);
        } catch (error) {
            showError(`Error processing ${files[i].name}: ${error.message}`);
        }
    }
    
    // Add new activities to existing list instead of replacing
    activities.push(...newActivities);
    saveActivitiesToLocalStorage();
    hideProgress();
    updateUI();
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

function parseRouteData(text) {
    const trimmed = text.trim();
    
    // 1. Try GPX format first (look for GPX XML structure)
    if (trimmed.includes('<gpx') || trimmed.includes('<trkpt')) {
        return parseGPXText(trimmed);
    }
    
    // 2. If not GPX, try polyline formats
    return parsePolylineText(trimmed);
}

function parseGPXText(gpxText) {
    try {
        const parser = new DOMParser();
        const gpxDoc = parser.parseFromString(gpxText, 'text/xml');
        
        if (gpxDoc.querySelector('parsererror')) {
            throw new Error('Invalid GPX format');
        }
        
        const points = [];
        const trackPoints = gpxDoc.querySelectorAll('trkpt');
        
        if (trackPoints.length === 0) {
            throw new Error('No track points found in GPX');
        }
        
        trackPoints.forEach(point => {
            const lat = parseFloat(point.getAttribute('lat'));
            const lon = parseFloat(point.getAttribute('lon'));
            
            if (!isNaN(lat) && !isNaN(lon)) {
                points.push({ lat, lon });
            }
        });
        
        if (points.length < 2) {
            throw new Error('Not enough valid GPS points in GPX');
        }
        
        // Try to extract date from various GPX elements
        let activityDate = null;
        
        // 1. Check metadata time
        const metadataTime = gpxDoc.querySelector('metadata time');
        if (metadataTime && metadataTime.textContent) {
            activityDate = new Date(metadataTime.textContent);
        }
        
        // 2. Check track time
        if (!activityDate) {
            const trackTime = gpxDoc.querySelector('trk time');
            if (trackTime && trackTime.textContent) {
                activityDate = new Date(trackTime.textContent);
            }
        }
        
        // 3. Check first track point time
        if (!activityDate) {
            const firstTrkpt = gpxDoc.querySelector('trkpt time');
            if (firstTrkpt && firstTrkpt.textContent) {
                activityDate = new Date(firstTrkpt.textContent);
            }
        }
        
        // 4. Check track segment time
        if (!activityDate) {
            const trksegTime = gpxDoc.querySelector('trkseg time');
            if (trksegTime && trksegTime.textContent) {
                activityDate = new Date(trksegTime.textContent);
            }
        }
        
        // Validate the date
        if (activityDate && isNaN(activityDate.getTime())) {
            activityDate = null;
        }

        // Try to extract activity type from various GPX elements
        let activityType = 'Unknown';
        
        // 1. Check track type
        const trackType = gpxDoc.querySelector('trk type');
        if (trackType && trackType.textContent) {
            activityType = trackType.textContent.trim();
        }
        
        // 2. Check metadata type if track type not found
        if (activityType === 'Unknown') {
            const metadataType = gpxDoc.querySelector('metadata type');
            if (metadataType && metadataType.textContent) {
                activityType = metadataType.textContent.trim();
            }
        }
        
        // Normalize activity type (capitalize first letter)
        if (activityType !== 'Unknown') {
            activityType = activityType.toLowerCase();
            activityType = activityType.charAt(0).toUpperCase() + activityType.slice(1);
        }

        return {
            name: 'GPX Track',
            polyline: encodePolyline(points),
            distance: calculateTotalDistance(points),
            date: activityDate,
            activityType: activityType
        };
    } catch (error) {
        throw new Error('GPX parsing failed: ' + error.message);
    }
}

function parsePolylineText(text) {
    const trimmed = text.trim();
    
    // Try to detect and parse different polyline formats
    let points = [];
    
    // 1. Try encoded polyline (Google Maps format)
    if (isEncodedPolyline(trimmed)) {
        points = decodePolyline(trimmed);
    }
    // 2. Try Google Maps URL extraction
    else if (trimmed.includes('google.com/maps') || trimmed.includes('maps.google.com')) {
        points = extractPolylineFromURL(trimmed);
    }
    // 3. Try JSON format [[lat,lng], [lat,lng], ...]
    else if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        points = parseJSONPolyline(trimmed);
    }
    // 4. Try CSV format (lat,lng per line)
    else if (trimmed.includes(',')) {
        points = parseCSVPolyline(trimmed);
    }
    // 5. Try space-separated format
    else {
        points = parseSpaceSeparatedPolyline(trimmed);
    }
    
    if (points.length < 2) {
        throw new Error('Not enough valid GPS points found. Supported formats:\n• GPX files\n• Encoded polyline\n• JSON: [[lat,lng],[lat,lng],...]\n• CSV: lat,lng (one per line)\n• Google Maps URL');
    }
    
    return {
        name: 'Polyline Track',
        polyline: encodePolyline(points),
        distance: calculateTotalDistance(points),
        enabled: true,
        id: Date.now(),
        date: null,
        activityType: 'Unknown'
    };
}

function isEncodedPolyline(text) {
    // Encoded polylines typically contain only specific characters
    return /^[a-zA-Z0-9_\-~`@\?\\\{\}\|\[\]]*$/.test(text) && text.length > 10;
}

function encodePolyline(points) {
    // Google's polyline encoding algorithm implementation
    let encoded = '';
    let lat = 0;
    let lng = 0;

    for (const point of points) {
        const dlat = Math.round(point.lat * 1e5) - lat;
        const dlng = Math.round(point.lon * 1e5) - lng;
        
        lat = Math.round(point.lat * 1e5);
        lng = Math.round(point.lon * 1e5);

        encoded += encodeValue(dlat) + encodeValue(dlng);
    }

    return encoded;
}

function encodeValue(value) {
    value = value < 0 ? ~(value << 1) : (value << 1);
    let encoded = '';
    
    while (value >= 0x20) {
        encoded += String.fromCharCode((0x20 | (value & 0x1f)) + 63);
        value >>= 5;
    }
    
    encoded += String.fromCharCode(value + 63);
    return encoded;
}

function decodePolyline(encoded) {
    // Google's polyline algorithm implementation
    const points = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
        let shift = 0;
        let result = 0;
        let byte;

        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);

        const deltaLat = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += deltaLat;

        shift = 0;
        result = 0;

        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);

        const deltaLng = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lng += deltaLng;

        points.push({
            lat: lat / 1e5,
            lon: lng / 1e5
        });
    }

    return points;
}

// Helper function to get decoded points from activity (handles both old and new formats)
function getActivityPoints(activity) {
    if (activity.polyline) {
        // New format - decode polyline
        return decodePolyline(activity.polyline);
    } else if (activity.points) {
        // Old format - return points directly
        return activity.points;
    }
    return [];
}

function extractPolylineFromURL(url) {
    // Extract encoded polyline from Google Maps URL
    const matches = url.match(/!1d([^!]+)!2d([^!]+)!3d([^!]+)/g) || 
                   url.match(/path=enc:([^&]+)/);
    
    if (matches) {
        if (url.includes('path=enc:')) {
            const encoded = matches[0].split('path=enc:')[1];
            return decodePolyline(encoded);
        } else {
            // Extract coordinates from !1d!2d!3d format
            const coords = [];
            matches.forEach(match => {
                const parts = match.split('!');
                if (parts.length >= 4) {
                    const lat = parseFloat(parts[3].substring(2));
                    const lon = parseFloat(parts[2].substring(2));
                    if (!isNaN(lat) && !isNaN(lon)) {
                        coords.push({ lat, lon });
                    }
                }
            });
            return coords;
        }
    }
    
    throw new Error('Could not extract polyline from URL');
}

function parseJSONPolyline(text) {
    try {
        const data = JSON.parse(text);
        if (!Array.isArray(data)) {
            throw new Error('JSON must be an array');
        }
        
        return data.map(point => {
            if (Array.isArray(point) && point.length >= 2) {
                return { lat: point[0], lon: point[1] };
            } else if (point.lat !== undefined && point.lon !== undefined) {
                return { lat: point.lat, lon: point.lon };
            } else if (point.latitude !== undefined && point.longitude !== undefined) {
                return { lat: point.latitude, lon: point.longitude };
            }
            throw new Error('Invalid point format in JSON');
        });
    } catch (e) {
        throw new Error('Invalid JSON format: ' + e.message);
    }
}

function parseCSVPolyline(text) {
    const lines = text.split('\n').filter(line => line.trim());
    const points = [];
    
    for (const line of lines) {
        // Skip header lines
        if (line.toLowerCase().includes('lat') && line.toLowerCase().includes('lon')) {
            continue;
        }
        
        const parts = line.split(',').map(p => p.trim());
        if (parts.length >= 2) {
            const lat = parseFloat(parts[0]);
            const lon = parseFloat(parts[1]);
            
            if (!isNaN(lat) && !isNaN(lon)) {
                points.push({ lat, lon });
            }
        }
    }
    
    return points;
}

function parseSpaceSeparatedPolyline(text) {
    const parts = text.split(/\s+/).filter(p => p.trim());
    const points = [];
    
    for (let i = 0; i < parts.length - 1; i += 2) {
        const lat = parseFloat(parts[i]);
        const lon = parseFloat(parts[i + 1]);
        
        if (!isNaN(lat) && !isNaN(lon)) {
            points.push({ lat, lon });
        }
    }
    
    return points;
}

function calculateTotalDistance(pointsOrActivity) {
    let points;
    if (Array.isArray(pointsOrActivity)) {
        // Called with points array
        points = pointsOrActivity;
    } else {
        // Called with activity object - get points using helper
        points = getActivityPoints(pointsOrActivity);
    }
    
    let total = 0;
    for (let i = 1; i < points.length; i++) {
        total += haversineDistance(points[i-1], points[i]);
    }
    return total;
}

function formatActivityDate(date) {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
        return '-';
    }
    
    // Format as YYYY-MM-DD
    return date.toLocaleDateString('en-CA'); // ISO format (YYYY-MM-DD)
}

function haversineDistance(point1, point2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLon = (point2.lon - point1.lon) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
             Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
             Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function updateUI() {
    const enabledActivities = activities.filter(a => a.enabled);
    clearBtn.disabled = activities.length === 0;
    updateActivityTypeFilter();
    updateActivitiesTable();
    
    if (enabledActivities.length > 0) {
        showStats();
        clearError();
        generateImage(); // Auto-generate when activities are enabled
    } else if (activities.length > 0) {
        showNoEnabledActivitiesMessage();
        // Clear canvas when no activities are enabled
        ctx.fillStyle = DEFAULT_THEME.background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        downloadBtn.disabled = true;
    }
}

function updateActivitiesTable() {
    // Clear existing rows
    activitiesTableBody.innerHTML = '';
    
    // Filter activities based on selected type
    const selectedType = activityTypeFilter.value;
    const filteredActivities = selectedType === 'all' 
        ? activities 
        : activities.filter(a => (a.activityType || 'Unknown') === selectedType);
    
    filteredActivities.forEach((activity, index) => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>
                <input type="checkbox" ${activity.enabled ? 'checked' : ''} 
                       onchange="toggleActivity(${activity.id})" />
            </td>
            <td>
                <div class="activity-name" title="${activity.name}">${activity.name}</div>
            </td>
            <td class="activity-stats">${formatActivityDate(activity.date)}</td>
            <td class="activity-stats">${activity.activityType || 'Unknown'}</td>
            <td class="activity-stats">${(activity.distance / 1000).toFixed(1)} km</td>
            <td class="activity-actions">
                <button class="delete-btn" onclick="deleteActivity(${activity.id})" title="Delete activity">
                    ✕
                </button>
            </td>
        `;
        
        activitiesTableBody.appendChild(row);
    });

    // Update select all checkbox state based on filtered activities
    const enabledCount = filteredActivities.filter(a => a.enabled).length;
    selectAllCheckbox.checked = enabledCount === filteredActivities.length && filteredActivities.length > 0;
    selectAllCheckbox.indeterminate = enabledCount > 0 && enabledCount < filteredActivities.length;
}

function toggleActivity(activityId) {
    const activity = activities.find(a => a.id === activityId);
    if (activity) {
        activity.enabled = !activity.enabled;
        saveActivitiesToLocalStorage();
        updateUI();
    }
}

function deleteActivity(activityId) {
    const activityIndex = activities.findIndex(a => a.id === activityId);
    if (activityIndex !== -1) {
        const activity = activities[activityIndex];
        if (confirm(`Are you sure you want to delete "${activity.name}"? This cannot be undone.`)) {
            activities.splice(activityIndex, 1);
            saveActivitiesToLocalStorage();
            updateUI();
        }
    }
}

function handleSelectAll() {
    const shouldEnable = selectAllCheckbox.checked;
    
    // Get filtered activities based on current filter
    const selectedType = activityTypeFilter.value;
    const filteredActivities = selectedType === 'all' 
        ? activities 
        : activities.filter(a => (a.activityType || 'Unknown') === selectedType);
    
    // Only update filtered activities
    filteredActivities.forEach(activity => {
        activity.enabled = shouldEnable;
    });
    
    saveActivitiesToLocalStorage();
    updateUI();
}

function handleTypeFilter() {
    updateActivitiesTable();
}

function updateActivityTypeFilter() {
    // Store current selection before rebuilding
    const currentSelection = activityTypeFilter.value;
    
    // Get unique activity types
    const types = [...new Set(activities.map(a => a.activityType || 'Unknown'))].sort();
    
    // Clear existing options except "All Types"
    activityTypeFilter.innerHTML = '<option value="all">All Types</option>';
    
    // Add type options
    types.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        activityTypeFilter.appendChild(option);
    });
    
    // Restore previous selection if it still exists, otherwise default to "all"
    if (currentSelection === 'all' || types.includes(currentSelection)) {
        activityTypeFilter.value = currentSelection;
    } else {
        activityTypeFilter.value = 'all';
    }
}

function handleSort(column) {
    // Toggle direction if same column, otherwise reset to ascending
    if (currentSortColumn === column) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = column;
        currentSortDirection = 'asc';
    }
    
    sortActivities();
    updateActivitiesTable();
    updateSortIndicators();
}

function sortActivities() {
    activities.sort((a, b) => {
        let aValue, bValue;
        
        switch (currentSortColumn) {
            case 'name':
                aValue = a.name || '';
                bValue = b.name || '';
                break;
            case 'date':
                aValue = a.date ? a.date.getTime() : 0;
                bValue = b.date ? b.date.getTime() : 0;
                break;
            case 'activityType':
                aValue = a.activityType || 'Unknown';
                bValue = b.activityType || 'Unknown';
                break;
            case 'distance':
                aValue = a.distance || 0;
                bValue = b.distance || 0;
                break;
            default:
                return 0;
        }
        
        if (currentSortDirection === 'asc') {
            return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        } else {
            return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        }
    });
}

function updateSortIndicators() {
    // Clear all indicators
    const indicators = document.querySelectorAll('.sort-indicator');
    indicators.forEach(indicator => {
        indicator.textContent = '';
    });
    
    // Set current column indicator
    if (currentSortColumn) {
        const header = document.querySelector(`[data-column="${currentSortColumn}"] .sort-indicator`);
        if (header) {
            header.textContent = currentSortDirection === 'asc' ? ' ▲' : ' ▼';
        }
    }
}

function clearAllActivities() {
    if (confirm('Are you sure you want to clear all activities? This cannot be undone.')) {
        activities = [];
        saveActivitiesToLocalStorage();
        updateUI();
        clearError();
        statsContainer.innerHTML = '';
        // Clear canvas
        ctx.fillStyle = DEFAULT_THEME.background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        downloadBtn.disabled = true;
    }
}

function showNoEnabledActivitiesMessage() {
    statsContainer.innerHTML = `
        <div class="stats">
            <h3>No Activities Selected</h3>
            <p>Check the boxes next to activities you want to include in the visualization.</p>
        </div>
    `;
}

// Make functions globally accessible
window.toggleActivity = toggleActivity;
window.deleteActivity = deleteActivity;

function showStats() {
    const enabledActivities = activities.filter(a => a.enabled);
    const totalPoints = enabledActivities.reduce((sum, a) => sum + getActivityPoints(a).length, 0);
    const totalDistance = enabledActivities.reduce((sum, a) => sum + a.distance, 0);
    
    statsContainer.innerHTML = `
        <div class="stats">
            <h3>Selected Activities Stats</h3>
            <p><strong>Total Activities:</strong> ${activities.length} (${enabledActivities.length} selected)</p>
            <p><strong>Total Points:</strong> ${totalPoints.toLocaleString()}</p>
            <p><strong>Total Distance:</strong> ${(totalDistance / 1000).toFixed(1)} km</p>
        </div>
    `;
}

function generateImage() {
    const enabledActivities = activities.filter(a => a.enabled);
    if (enabledActivities.length === 0) return;
    
    updateCanvasSize();
    
    const lineWidth = parseFloat(lineWidthSlider.value);
    
    // Clear canvas
    ctx.fillStyle = DEFAULT_THEME.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Transform coordinates
    const bounds = calculateBounds(enabledActivities);
    const padding = 50;
    const scale = Math.min(
        (canvas.width - 2 * padding) / (bounds.maxLon - bounds.minLon),
        (canvas.height - 2 * padding) / (bounds.maxLat - bounds.minLat)
    );
    
    // Draw enabled activities only
    let enabledIndex = 0;
    activities.forEach((activity, originalIndex) => {
        const points = getActivityPoints(activity);
        if (!activity.enabled || points.length < 2) return;
        
        ctx.strokeStyle = DEFAULT_THEME.colour;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        points.forEach((point, i) => {
            const x = padding + (point.lon - bounds.minLon) * scale;
            const y = canvas.height - (padding + (point.lat - bounds.minLat) * scale);
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();
        enabledIndex++;
    });
    
    downloadBtn.disabled = false;
}

function calculateBounds(activities) {
    let minLat = Infinity, maxLat = -Infinity;
    let minLon = Infinity, maxLon = -Infinity;
    
    activities.forEach(activity => {
        const points = getActivityPoints(activity);
        points.forEach(point => {
            minLat = Math.min(minLat, point.lat);
            maxLat = Math.max(maxLat, point.lat);
            minLon = Math.min(minLon, point.lon);
            maxLon = Math.max(maxLon, point.lon);
        });
    });
    
    return { minLat, maxLat, minLon, maxLon };
}

function downloadImage() {
    const link = document.createElement('a');
    link.download = 'etch-a-trek-' + new Date().toISOString().slice(0, 10) + '.png';
    link.href = canvas.toDataURL();
    link.click();
}

function showProgress(percent) {
    progressContainer.style.display = 'block';
    progressBar.style.width = percent + '%';
}

function hideProgress() {
    progressContainer.style.display = 'none';
}

function showError(message) {
    errorContainer.innerHTML = `<div class="error">${message}</div>`;
}

function clearError() {
    errorContainer.innerHTML = '';
}

// Add custom size input listeners with auto-generation
customWidth.addEventListener('input', () => {
    updateCanvasSize();
    if (activities.filter(a => a.enabled).length > 0) {
        generateImage();
    }
});
customHeight.addEventListener('input', () => {
    updateCanvasSize();
    if (activities.filter(a => a.enabled).length > 0) {
        generateImage();
    }
});