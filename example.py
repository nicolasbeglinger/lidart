#%%
import laspy
import numpy as np
from sklearn.decomposition import PCA
import pandas as pd
import geopandas as gpd
import os
import urllib.request
from datetime import datetime

import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation
plt.style.use('dark_background')

#%%
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


#%%
if not os.path.exists("temp"):
    os.mkdir("temp")

if not os.path.exists("img"):
    os.mkdir("img")

#%%
url_laz = "https://maps.zh.ch/download/hoehen/2022/lidar/2683000_1247000.laz"

filename = url_laz.split(os.sep)[-1]
new_path = os.path.join("temp", filename)

if not os.path.exists(new_path):
    with urllib.request.urlopen(url_laz) as f:
        with open(new_path, "wb") as f_new:
            f_new.write(f.read())

#%%
with laspy.open(new_path) as f:
    laz = f.read()

#%%
outline = gpd.read_file("geom/cut_geom.gpkg").to_crs(21781)

#%%

points = pd.DataFrame({
    "X": laz["X"] / 1000,
    "Y": laz["Y"] / 1000,
    "Z": laz["Z"] / 1000,
})



#%% 
minx, miny, maxx, maxy = outline.bounds.values[0]
# 683451.31124748, 247157.49661449, 683527.10629864, 247215.30924776

filtered = points[
    (points.X > minx) &
    (points.X < maxx) &
    (points.Y > miny) &
    (points.Y < maxy) 
]

#%%
x, y = rotate_points(
    filtered.X,
    filtered.Y
    )

rotated = pd.DataFrame({
    "X": x,
    "Y": y,
    "Z": filtered.Z
})



#%%


def plot_lidar(lateral_vals, depth_vals, Z, focal_value, flipped=False,     
    bokeh=None, s_decay=1, alpha_decay=10, save=False):

    if flipped:
        lateral_vals = np.flip(lateral_vals)
        Z = np.flip(Z)
    
    if not bokeh is None:
        bokeh += 1e-5
        bokeh = 1 / bokeh
        s_decay = 10 * bokeh
        alpha_decay = 10 * bokeh

    focal_abs_value = np.min(depth_vals) + focal_value

    plt.figure(figsize=(20, 20), dpi=100)
    plt.scatter(
        x=lateral_vals,
        y=Z,
        s= 1 + (1 - sigma_decay(depth_vals, focal_abs_value, s_decay)) * 100,
        alpha=sigma_decay(depth_vals, focal_abs_value, alpha_decay),
        color="white"
        )
    plt.axis('equal')
    plt.axis('off')

    if save:
        formatted_time = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        plt.savefig(f"img/{formatted_time}_figure.png")

plot_lidar(
    rotated.Y, rotated.Y, rotated.Z,
    focal_value=30, bokeh=1)



# # %%
# # Setting up the plot
# fig, ax = plt.subplots(figsize=(20, 20), dpi=100)

# # Scatter plot initialization
# sc = ax.scatter(
#     filtered.Y,
#     filtered.Z,
#     s=5,  # Initial size, will be updated
#     alpha=0.5,  # Initial alpha, will be updated
#     color="white"
# )
# ax.axis('equal')
# ax.axis('off')

# def update(value):
#     # Update the size and alpha based on the current value
#     sizes = 5 + (1 - sigma_decay(filtered.X, value, 4)) * 50
#     alphas = sigma_decay(filtered.X, value, 6)
#     sc.set_sizes(sizes)
#     sc.set_alpha(alphas)

# # Create animation
# ani = FuncAnimation(fig, update, frames=np.linspace(maxx, minx, 50), interval=10)

# # # To display the animation in a Jupyter notebook
# # from IPython.display import HTML
# # plt.close(fig)  # Close the static figure to prevent display
# # HTML(ani.to_jshtml())  # Display as JavaScript HTML

# formatted_time = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
# ani.save(f'ani/animation_{formatted_time}.gif', writer='imagemagick', fps=20)
