from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('lidart_plot', views.lidart_plot, name='lidart_plot'),
    path('get_cached_coords', views.get_cached_coords, name='get_cached_coords'),
]
