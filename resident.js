let residentMap;
let selectedMarker;

// Chaza imingcele yaseDlangezwa (Dlangezwa Bounding Box)
const dlangezwaBounds = {
    north: -28.8200,
    south: -28.9000,
    west: 31.8000,
    east: 31.8800
};

function isInsideDlangezwa(lat, lng) {
    return lat <= dlangezwaBounds.north &&
           lat >= dlangezwaBounds.south &&
           lng >= dlangezwaBounds.west &&
           lng <= dlangezwaBounds.east;
}

document.addEventListener("DOMContentLoaded", () => {
    loadMyReports();
    initResidentMap();
});

// 1. INITIALIZE INTERACTIVE MAP FOR RESIDENT (Dlangezwa / UniZulu)
function initResidentMap() {
    const mapElement = document.getElementById('resident-map');
    if (!mapElement) return;

    // Center coordinates for Dlangezwa / UniZulu
    const dlangezwaCoords = [-28.8583, 31.8483];
    
    residentMap = L.map('resident-map').setView(dlangezwaCoords, 14);

    // Using Esri ArcGIS World Imagery (Satellite view like Google Maps)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-iPC, USGS, and the GIS User Community'
    }).addTo(residentMap);

    // Add initial default pin
    selectedMarker = L.marker(dlangezwaCoords, { draggable: true }).addTo(residentMap);
    updateCoordsInput(dlangezwaCoords[0], dlangezwaCoords[1]);

    // POINT & CLICK EVENT: Allow resident to click anywhere on map to drop pin within Dlangezwa
    residentMap.on('click', (e) => {
        const { lat, lng } = e.latlng;
        if (isInsideDlangezwa(lat, lng)) {
            selectedMarker.setLatLng([lat, lng]);
            updateCoordsInput(lat, lng);
        } else {
            alert("Please select a location within the Dlangezwa project area only!");
        }
    });

    // DRAG EVENT: Allow resident to drag the pin around within Dlangezwa
    selectedMarker.on('dragend', (e) => {
        const position = selectedMarker.getLatLng();
        if (isInsideDlangezwa(position.lat, position.lng)) {
            updateCoordsInput(position.lat, position.lng);
        } else {
            alert("The marker must stay within the Dlangezwa project area!");
            selectedMarker.setLatLng(dlangezwaCoords);
            updateCoordsInput(dlangezwaCoords[0], dlangezwaCoords[1]);
        }
    });
}

// Update hidden inputs with selected coordinates
function updateCoordsInput(lat, lng) {
    const latInput = document.getElementById("latitude");
    const lngInput = document.getElementById("longitude");
    const coordsText = document.getElementById("selected-coords-text");

    if (latInput) latInput.value = lat;
    if (lngInput) lngInput.value = lng;

    if (coordsText) {
        coordsText.style.display = "block";
        coordsText.innerText = `📍 Selected Map Pin GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
}

// 2. FETCH REPORTS SUBMITTED BY RESIDENT
async function loadMyReports() {
    const userId = localStorage.getItem("userId");
    if (!userId) return;

    try {
        const response = await fetch(`http://127.0.0.1:5000/api/resident-reports?user_id=${userId}`);
        const data = await response.json();

        if (response.ok) {
            renderResidentReports(data.reports);
        } else {
            console.error("Failed to load reports:", data.message);
        }
    } catch (error) {
        console.error("Error connecting to server:", error);
    }
}

function renderResidentReports(reports) {
    const tableBody = document.getElementById("resident-reports-table");
    tableBody.innerHTML = "";

    if (!reports || reports.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center;">You have not submitted any reports yet.</td></tr>`;
        return;
    }

    reports.forEach(report => {
        const reportDate = report.created_at 
            ? new Date(report.created_at).toLocaleDateString() 
            : new Date().toLocaleDateString();

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>#${report.id}</td>
            <td><strong>${reportDate}</strong></td>
            <td>${report.issue_type}</td>
            <td>
                ${report.location}<br>
                ${report.latitude && report.longitude 
                    ? `<a href="https://www.google.com/maps?q=${report.latitude},${report.longitude}" target="_blank" style="color: #1976d2; font-size: 12px; font-weight: bold;">🗺️ View GPS</a>` 
                    : '<span style="color: gray; font-size: 12px;">No GPS</span>'}
            </td>
            <td>${report.description}</td>
            <td>
                ${report.image_path 
                    ? `<a href="http://127.0.0.1:5000/uploads/${report.image_path}" target="_blank" style="color: #2e7d32; font-weight: bold;">View Photo</a>` 
                    : 'No Photo'}
            </td>
            <td><span class="status-badge ${report.status ? report.status.toLowerCase() : 'pending'}">${report.status || 'Pending'}</span></td>
        `;
        tableBody.appendChild(row);
    });
}

// 3. SUBMIT NEW INCIDENT REPORT WITH MAP COORDINATES
async function submitReport(event) {
    event.preventDefault();

    const userId = localStorage.getItem("userId") || 1;
    const issueType = document.getElementById("issue-type").value;
    const location = document.getElementById("location").value;
    const description = document.getElementById("description").value;
    const imageInput = document.getElementById("image").files[0];
    const latitude = document.getElementById("latitude").value;
    const longitude = document.getElementById("longitude").value;
    const formMsg = document.getElementById("form-msg");

    if (!imageInput) {
        formMsg.style.color = "red";
        formMsg.innerText = "Please select an incident photo before submitting.";
        return;
    }

    if (!latitude || !longitude) {
        formMsg.style.color = "red";
        formMsg.innerText = "Please point a location on the map before submitting.";
        return;
    }

    const formData = new FormData();
    formData.append("user_id", userId);
    formData.append("issue_type", issueType);
    formData.append("location", location);
    formData.append("description", description);
    formData.append("image", imageInput);
    formData.append("latitude", latitude);
    formData.append("longitude", longitude);

    try {
        const response = await fetch('http://127.0.0.1:5000/api/submit-report', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            formMsg.style.color = "green";
            formMsg.innerText = "Report and map GPS pin submitted successfully!";
            document.getElementById("incident-form").reset();
            loadMyReports();
        } else {
            formMsg.style.color = "red";
            formMsg.innerText = data.message || "Failed to submit report.";
        }
    } catch (error) {
        console.error("Error submitting report:", error);
        formMsg.style.color = "red";
        formMsg.innerText = "Could not connect to server.";
    }
}

function logout() {
    localStorage.clear();
    window.location.href = "index.html";
}