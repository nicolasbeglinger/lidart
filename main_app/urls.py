from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('lidart_plot', views.lidart_plot, name='lidart_plot'),
]
