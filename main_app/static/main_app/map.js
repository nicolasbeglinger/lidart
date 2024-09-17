

var overlayMaps = {
    "swissIMAGE": L.tileLayer.swiss({
        layer: "ch.swisstopo.swissimage",
        maxNativeZoom: 28
    }),
    "swissSURFACE3D Relief": L.tileLayer.swiss({
        format: "png",
        layer: "ch.swisstopo.swisssurface3d-reliefschattierung-multidirektional",
        opacity: 0.5,
        maxNativeZoom: 26
    })
}

const map = L.map("mapid", {
    crs: L.CRS.EPSG21781,
    center: [47.370185, 8.543],
    zoom: 26,
    minZoom: 20,
    maxZoom: 28,
    layers: [L.tileLayer.swiss()]
});

var layercontrol = L.control.layers([], overlayMaps).addTo(map);

// Draw Control Setup (unchanged)
var bbox_for_display = new L.FeatureGroup();
map.addLayer(bbox_for_display);

const bbox_id = bbox_for_display._leaflet_id;

// Function to draw the grid
function drawGrid(sidelength=500) {

    map.eachLayer(function(layer) {
        if (!!layer.toGeoJSON) {  // Check if the layer has a toGeoJSON method, indicating it's a vector layer
            if (layer._leaflet_id !== bbox_id) {  // Only proceed if the layer is not bbox_for_display
                let isSublayer = false;

                // Check if the layer is a sublayer of bbox_for_display
                if (bbox_for_display.hasLayer(layer)) {
                    isSublayer = true;
                }

                if (!isSublayer) {  // If it's not a sublayer of bbox_for_display, remove it
                    map.removeLayer(layer);
                }
            }
        }
    });


    const bounds = map.getBounds();

    // Project map bounds to EPSG:2056
    var sw = L.CRS.EPSG2056.project(bounds.getSouthWest());
    var ne = L.CRS.EPSG2056.project(bounds.getNorthEast());

    var startX = Math.floor(sw.x / 500) * 500;
    var endX = Math.ceil(ne.x / 500) * 500;  // Use ceil to ensure full coverage
    var startY = Math.floor(sw.y / 500) * 500;
    var endY = Math.ceil(ne.y / 500) * 500;  // Use ceil to ensure full coverage

    let xmin = null;
    let xmax = null;
    let ymin = null;
    let ymax = null;

    // console.log(sw.x)
    console.log(Math.floor(sw.x / 500) * 500)
    console.log(startX, endX, startY, endY)
    // Loop through the grid coordinates
    for (let x = startX; x < endX; x += 500) {

        
        if (!xmin) {
            xmin = L.CRS.EPSG2056.unproject(L.point(x, startY)).lng;
        }
        xmax = L.CRS.EPSG2056.unproject(L.point(x+500, startY+500)).lng;

        for (let y = startY; y < endY; y += 500) {

            if (!ymin) {
                ymin = L.CRS.EPSG2056.unproject(L.point(startX, y)).lat;
            }
            ymax = L.CRS.EPSG2056.unproject(L.point(startX, y+500)).lat;

            const bounds = [
                [ymin, xmin],
                [ymax, xmax]
            ];

            // Draw the rectangle using the stored coordinates
            L.rectangle(bounds, {
                color: 'green',
                weight: 6,
                fillOpacity: 0,
                interactive: false  // Ensure grid is non-interactive
            }).addTo(map);

            ymin = ymax * 1;
        }
        ymin = null;
        xmin = xmax * 1;
    }
}

// Draw the grid initially
drawGrid();


// Update the grid when the map moves or zooms
map.on('moveend', drawGrid);


var drawControl = new L.Control.Draw({
    edit: {
        featureGroup: bbox_for_display,
        edit: false,
        remove: false
    },
    draw: {
        polyline: false,
        circle: false,
        circlemarker: false,
        polygon: false,
        marker: false,
        rectangle: true
    }
});
map.addControl(drawControl);


map.on('draw:drawstart', function (e) {
    bbox_for_display.clearLayers()
});

map.on('draw:created', function (e) {
    var type = e.layerType, layer = e.layer;

    if (type === 'rectangle') {
        bbox_for_display.addLayer(layer);

        var bounds = layer.getBounds();
        var sw = L.CRS.EPSG21781.project(bounds.getSouthWest());
        var ne = L.CRS.EPSG21781.project(bounds.getNorthEast());

        var bbox = {
            xmin: sw.x,
            xmax: ne.x,
            ymin: sw.y,
            ymax: ne.y
        };

        fetch(plot_url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({ bbox: bbox })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.blob();
        })
        .then(imageBlob => {
            const imageUrl = URL.createObjectURL(imageBlob);
            document.getElementById('plotted_lidar_data').innerHTML = `<img src="${imageUrl}" alt="LiDAR Data Plot" class="img-fluid"/>`;
        })
        .catch(error => {
            console.error('There was a problem with the fetch operation:', error);
            document.getElementById('plotted_lidar_data').innerHTML = `<p class="text-danger">Error: ${error.message}</p>`;
        });
    }
});
