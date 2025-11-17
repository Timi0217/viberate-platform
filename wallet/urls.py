"""URL patterns for wallet endpoints"""
from django.urls import path
from . import views

urlpatterns = [
    path('balance/', views.get_balance, name='wallet-balance'),
    path('transfer/', views.transfer_usdc, name='wallet-transfer'),
    path('transactions/', views.transaction_history, name='wallet-transactions'),
    path('onramp-session-token/', views.generate_onramp_session_token, name='onramp-session-token'),
]
