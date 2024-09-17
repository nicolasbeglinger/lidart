from django.shortcuts import render
from django.conf import settings

import matplotlib.pyplot as plt
from django.http import HttpResponse
from io import BytesIO

# lidart_plot
import laspy
import numpy as np
from sklearn.decomposition import PCA
import pandas as pd
import os
import urllib.request
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
plt.style.use('dark_background')

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
import json



def rotate_points(x, y):
    # Stack x and y coordinates horizontally
    points = np.vstack([x, y]).T
    
    # Initialize PCA and fit the points
    pca = PCA(n_components=2)
    pca.fit(points)
    
    # Determine the principal components
    pc1, pc2 = pca.components_
    
    # Calculate the angle to rotate for pc1 (the longest side)
    angle = np.arctan2(pc1[1], pc1[0])
    
    # Ensure y values remain positive predominantly
    if np.sin(angle) < 0:
        angle += np.pi
    
    # Rotation matrix
    rotation_matrix = np.array([[np.cos(-angle), -np.sin(-angle)],
                                [np.sin(-angle),  np.cos(-angle)]])
    
    # Apply the rotation to the points
    rotated_points = points @ rotation_matrix.T
    
    return rotated_points[:, 0], rotated_points[:, 1]

def sigma_decay(array, target, sigma=1.0):
    """
    Adjusts values in the array based on their distance from a target value.
    Values closer to the target are adjusted towards 1, and those further away towards 0.
    
    Parameters:
    - array: numpy array of original values.
    - target: the target value that is considered the reference point.
    - sigma: standard deviation to control the steepness of the curve (default is 1.0).
    
    Returns:
    - A numpy array of adjusted values.
    """
    if array.mean() < 0:
        array *= -1
    # Compute the difference from the target
    diff = np.abs(array - target)
    
    # Apply a Gaussian function
    adjusted_values = np.exp(-0.5 * (diff / sigma) ** 2)
    
    return adjusted_values
    


def plot_lidar(lateral_vals, depth_vals, Z, focal_value, flipped=False,     
    bokeh=0, s_decay=100, alpha_decay=100):

    if flipped:
        lateral_vals = np.flip(lateral_vals)
        Z = np.flip(Z)
    
    if bokeh is not None:
        bokeh += 1e-5
        bokeh = 1 / bokeh
        s_decay = 10 * bokeh
        alpha_decay = 10 * bokeh

    focal_abs_value = np.min(depth_vals) + focal_value

    plt.figure(figsize=(20, 20), dpi=100)
    plt.scatter(
        x=lateral_vals,
        y=Z,
        # s= 1 + (1 - sigma_decay(depth_vals, focal_abs_value, s_decay)) * 100,
        # alpha=sigma_decay(depth_vals, focal_abs_value, alpha_decay),
        s=1,
        color="white"
        )
    plt.axis('equal')
    plt.axis('off')


def home(request):
    return render(request, 'home.html')


@require_http_methods(["POST"])
def lidart_plot(request):
    try:
        data = json.loads(request.body)
        bbox = data.get('bbox', {})
        print("Received bbox:", bbox)  # Log the bbox to console or handle as needed
    except json.JSONDecodeError as e:
        return JsonResponse({'status': 'error', 'message': 'Invalid JSON data'}, status=400)
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)

    minx, maxx, miny, maxy = [value for value in bbox.values()]

    x_tile_test = np.floor(minx / 500.0) * 500.0 == np.floor(maxx / 500.0) * 500.0
    y_tile_test = np.floor(miny / 500.0) * 500.0 == np.floor(maxy / 500.0) * 500.0

    if not (x_tile_test and y_tile_test):

        plt.text(0.5, 0.5,
            "Bbox was selected across tile borders.\nThis is not allowed!",
            fontsize="xx-large", horizontalalignment="center")
        plt.axis('off')

        # Create a buffer to capture the image
        buffer = BytesIO()
        plt.savefig(buffer, format='png')
        plt.close()
        buffer.seek(0)

        # Return the buffer contents in the response
        return HttpResponse(buffer.getvalue(), content_type='image/png')

    x_lower_500 = int(np.floor(minx / 500.0) * 500.0)
    y_lower_500 = int(np.floor(miny / 500.0) * 500.0)


    url_laz = f"https://maps.zh.ch/download/hoehen/2022/lidar/2{x_lower_500}_1{y_lower_500}.laz"

    filename = url_laz.split(os.sep)[-1]
    new_path = os.path.join(settings.TMP_DIR, filename)

    if not os.path.exists(new_path):

        list_of_files = os.listdir(settings.TMP_DIR)
        list_of_full_paths = [os.path.join(settings.TMP_DIR, x) for x in list_of_files]

        if len(list_of_files) == 7:
            oldest_file = min(list_of_full_paths, key=os.path.getctime)
            os.remove(oldest_file)


        with urllib.request.urlopen(url_laz) as f:
            with open(new_path, "wb") as f_new:
                f_new.write(f.read())
            
    
    with laspy.open(new_path) as f:
        laz = f.read()


    points = pd.DataFrame({
        "X": laz["X"] / 1000,
        "Y": laz["Y"] / 1000,
        "Z": laz["Z"] / 1000,
    })






    filtered = points[
        (points.X > minx) &
        (points.X < maxx) &
        (points.Y > miny) &
        (points.Y < maxy) 
    ]

    cap = 30_000
    if filtered.shape[0] > cap:
        filtered = filtered.sample(cap)

    print(filtered.shape[0])

    # x_rotated, y_rotated = rotate_points(
    #     filtered.X,
    #     filtered.Y
    #     )
    # rotated = pd.DataFrame({
    #     "X": x_rotated,
    #     "Y": y_rotated,
    #     "Z": filtered.Z
    # })
    if maxx - minx > maxy - miny:
        lateral = filtered.Y
        depth = filtered.X
    else:
        lateral = filtered.X
        depth = filtered.Y

    plot_lidar(
        lateral, depth, filtered.Z,
        focal_value=30, bokeh=0
        )


    # Create a buffer to capture the image
    buffer = BytesIO()
    plt.savefig(buffer, format='png')
    plt.close()
    buffer.seek(0)

    # Return the buffer contents in the response
    return HttpResponse(buffer.getvalue(), content_type='image/png')

