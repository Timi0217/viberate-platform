#!/bin/bash

echo "==================================="
echo "Viberate Platform Setup"
echo "==================================="
echo

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "Creating .env file from .env.example..."
    cp .env.example .env
    echo "Please edit .env file with your configuration!"
fi

echo
echo "==================================="
echo "Database Setup"
echo "==================================="
echo

# Check if PostgreSQL is running
if command -v psql &> /dev/null; then
    echo "PostgreSQL is installed."
    echo "Please ensure you have created the database:"
    echo "  createdb viberate_db"
    echo "  createuser -s postgres (if user doesn't exist)"
    echo
else
    echo "WARNING: PostgreSQL is not installed or not in PATH"
    echo "Please install PostgreSQL and create the database manually"
    echo
fi

# Run migrations
echo "Running migrations..."
python manage.py migrate

echo
echo "==================================="
echo "Create Superuser"
echo "==================================="
echo

read -p "Do you want to create a superuser now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    python manage.py createsuperuser
fi

echo
echo "==================================="
echo "Setup Complete!"
echo "==================================="
echo
echo "To start the development server:"
echo "  source venv/bin/activate"
echo "  python manage.py runserver"
echo
echo "The API will be available at: http://localhost:8000/api/"
echo "Admin interface: http://localhost:8000/admin/"
echo
