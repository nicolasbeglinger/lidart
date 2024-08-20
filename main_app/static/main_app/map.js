



var layers = [
    L.tileLayer.swiss({
        format: "png",
        layer: "ch.swisstopo.swisstlm3d-karte-farbe",
    }),
    L.tileLayer.swiss({
        format: "png",
        layer: "ch.swisstopo.swisssurface3d-reliefschattierung-multidirektional",
        opacity: 0.25,
        maxNativeZoom: 26
    })
]



// Create map and attach id to element with id "mapid"
 var map = L.map("mapid", {
    // Use LV95 (EPSG:2056) projection
    crs: L.CRS.EPSG21781,
    center: [47.370185, 8.543837],
    zoom: 27,
    minZoom: 26,
    maxZoom: 28,
    layers: layers
});



var bbox_for_display = new L.FeatureGroup();
map.addLayer(bbox_for_display);

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
map.addControl(drawControl)


map.on('draw:drawstart', function (e) {
    bbox_for_display.clearLayers()
})

map.on('draw:created', function (e) {

    var type = e.layerType, layer = e.layer;

    if (type === 'rectangle') {
        bbox_for_display.addLayer(layer);

        var bounds = layer.getBounds();
        var sw = L.CRS.EPSG21781.project(bounds.getSouthWest())
        var ne = L.CRS.EPSG21781.project(bounds.getNorthEast())


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
                'X-CSRFToken': csrfToken  // Include the CSRF token here
            },
            body: JSON.stringify({bbox: bbox})
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.blob();  // Convert the response to a Blob
        })
        .then(imageBlob => {
            // Create a URL for the image Blob
            const imageUrl = URL.createObjectURL(imageBlob);
            // Set the image URL in the `plotted_lidar_data` div
            document.getElementById('plotted_lidar_data').innerHTML = `<img src="${imageUrl}" alt="LiDAR Data Plot" class="img-fluid"/>`;
        })
        .catch(error => {
            console.error('There was a problem with the fetch operation:', error);
            document.getElementById('plotted_lidar_data').innerHTML = `<p class="text-danger">Error: ${error.message}</p>`;
        });
    }

});
