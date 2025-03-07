var overlayMaps = {
    "Landeskarte": L.tileLayer.swiss(),
    "swissSURFACE3D Relief": L.tileLayer.swiss({
        format: "png",
        layer: "ch.swisstopo.swisssurface3d-reliefschattierung-multidirektional",
        opacity: 0.5,
        maxNativeZoom: 26
    })
}

const map = L.map("mapid", {
    crs: L.CRS.EPSG21781,
    center: [47.379, 8.540],
    zoom: 23,
    minZoom: 20,
    maxZoom: 28,
    layers: [L.tileLayer.swiss({layer: "ch.swisstopo.swissimage", maxNativeZoom: 28})]
});

var layercontrol = L.control.layers([], overlayMaps).addTo(map);

// Draw Control Setup (unchanged)
var bbox_for_display = new L.FeatureGroup();
map.addLayer(bbox_for_display);

var viewDirection = new L.FeatureGroup();
map.addLayer(viewDirection);

const bbox_id = bbox_for_display._leaflet_id;
const viewDir_id = viewDirection._leaflet_id;

// Function to draw the grid
function drawGrid(sidelength=500) {

    map.eachLayer(function(layer) {
        if (!!layer.toGeoJSON) {  // Check if the layer has a toGeoJSON method, indicating it's a vector layer
            if (![bbox_id, viewDir_id].includes(layer._leaflet_id)) { 
            // if (layer._leaflet_id !== bbox_id ) {  // Only proceed if the layer is not bbox_for_display
                let isSublayer = false;

                // Check if the layer is a sublayer of bbox_for_display
                if (bbox_for_display.hasLayer(layer) | viewDirection.hasLayer(layer)) {
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

    let cached_exact_bounds = [];

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

            const bounds2056 = [
                [y, x],
                [y + 500, x + 500]
            ]

            // do the cached bounds contain the bounds2056?
            if (cached_bounds.some(bounds => JSON.stringify(bounds) === JSON.stringify(bounds2056))) {
                cached_exact_bounds.push(bounds);
                continue
            } 

            // Draw the rectangle using the stored coordinates
            L.rectangle(bounds, {
                color: "red",
                weight: 6,
                fillOpacity: 0,
                interactive: false  // Ensure grid is non-interactive
            }).addTo(map);            

            ymin = ymax * 1;
        }
        ymin = null;
        xmin = xmax * 1;
    }

    cached_exact_bounds.forEach(bounds => {
        // Draw the rectangle using the stored coordinates
        L.rectangle(bounds, {
            color: "green",
            weight: 7,
            fillOpacity: 0,
            interactive: false  // Ensure grid is non-interactive
        }).addTo(map);
    });

}


async function fetchCachedCoords() {
    return fetch(cached_coords_url, {
        method: 'GET',
        headers: {
            'Content-Type': 'text/json',
            'X-CSRFToken': csrfToken
        }})
        .then(response => {
            if (!response.ok) {
                console.log(response)
                throw new Error('Network response was not ok');
            }
        return response.json()
        })
        .then(data =>{

            // Define constant height and width
            const size = 500; // Both width and height are 500

            // Combine the coordinates into the desired format with conversion
            const combinedArray = data.x.map((xmin, index) => {
                var ymin = data.y[index];

                return [
                    [ymin, xmin],
                    [ymin + size, xmin + size]
                ];
            });

            console.log(combinedArray);

            return combinedArray;
        })
        .catch(error => console.error('Error: ', error));
}



// Immediately execute the fetch and stop execution until it's done
let cached_bounds;
(async () => {
    cached_bounds = await fetchCachedCoords();

    // Draw the grid initially
    drawGrid();
})();


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


map.on('draw:drawstart', function () {
    bbox_for_display.clearLayers()
    viewDirection.clearLayers()
});

let bokehSlider = document.getElementById("bokeh-range");
let distSlider = document.getElementById("distance-range");
let reloadButton = document.getElementById("reload-button");
let spinner = document.getElementById("spinner");
let bbox;

reloadButton.addEventListener("click", function() {
    if (bbox) {
        fetchDataAndUpdate(bbox); // Call the fetch function when the bokehSlider changes
    }
});

let downloadButton = document.getElementById("download-button");
let imageUrl;


downloadButton.addEventListener("click", function() {

    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = 'lidart_plot'; // Filename for the downloaded file
    link.click();
})

map.on('draw:created', function (e) {
    var layer = e.layer;

    bbox_for_display.addLayer(layer);

    var bounds = layer.getBounds();

    var sw = bounds.getSouthWest()
    var ne = bounds.getNorthEast()
    
    var sw_21781 = L.CRS.EPSG21781.project(sw);
    var ne_21781 = L.CRS.EPSG21781.project(ne);
    
    bbox = {
        xmin: sw_21781.x,
        xmax: ne_21781.x,
        ymin: sw_21781.y,
        ymax: ne_21781.y
    };

    xrange = ne_21781.x - sw_21781.x
    yrange = ne_21781.y - sw_21781.y

    if (yrange > xrange) { // portrait
        var arrowend = [sw.lat - 0.00005, sw.lng + (ne.lng - sw.lng) / 2]
        var arrowstart = [sw.lat - 0.0005, sw.lng + (ne.lng - sw.lng) / 2]
    } else { // landscape
        var arrowstart = [sw.lat + (ne.lat - sw.lat) / 2, sw.lng - 0.001]
        var arrowend = [sw.lat + (ne.lat - sw.lat) / 2, sw.lng - 0.0001]
    }
    
    viewDirection.addLayer(
        L.polyline([arrowstart, arrowend]).arrowheads()
    );

    fetchDataAndUpdate(bbox); // Call fetch function when a rectangle is drawn
    
});

function fetchDataAndUpdate(bbox = null) {
    // Show the spinner
    spinner.classList.remove('d-none');
    document.getElementById('plotted_lidar_data').innerHTML = '';

    const bokehValue = bokehSlider.value;
    const distValue = distSlider.value;

    console.log("bbox:", JSON.stringify(bbox));
    console.log("Bokeh Value:", bokehValue);
    console.log("Distance Value:", distValue);

    fetch(plot_url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken
        },
        body: JSON.stringify({ bbox: bbox, bokeh: bokehValue, distance: distValue })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.blob();
    })
    .then(imageBlob => {
        imageUrl = URL.createObjectURL(imageBlob);
        document.getElementById('plotted_lidar_data').innerHTML = `<img src="${imageUrl}" alt="LiDAR Data Plot" class="img-fluid"/>`;

        // Hide the spinner
        spinner.classList.add('d-none');

        
        // Activate reload button
        reloadButton.classList.remove("disabled");
        reloadButton.textContent = "Update Plot";

        // Display download button
        downloadButton.classList.remove('d-none')

    })
    .catch(error => {
        console.error('There was a problem with the fetch operation:', error);
        document.getElementById('plotted_lidar_data').innerHTML = `<p class="text-danger">Error: ${error.message}</p>`;
    })
    .finally(async() => {
        // important if cached tiles have changed
        cached_bounds = await fetchCachedCoords();
        drawGrid();
    })
}

