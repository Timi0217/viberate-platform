"""
Label Studio API client for syncing projects and tasks.
"""
from label_studio_sdk import Client
from django.conf import settings
import requests
from bs4 import BeautifulSoup


class LabelStudioClient:
    """Wrapper for Label Studio SDK with custom methods."""

    def __init__(self, api_url, api_token):
        """Initialize Label Studio client."""
        self.api_url = api_url
        self.api_token = api_token
        self.client = Client(url=api_url, api_key=api_token)

    def verify_connection(self):
        """Verify connection to Label Studio and get user info."""
        try:
            # Try to fetch projects to verify connection
            projects = self.client.list_projects()

            # Get current user info if available
            # Note: Label Studio SDK doesn't have a direct "get user" method
            # but we can verify the connection works
            return {
                'connected': True,
                'projects_count': len(projects),
                'api_url': self.api_url
            }
        except Exception as e:
            raise Exception(f"Failed to connect to Label Studio: {str(e)}")

    def get_projects(self):
        """Get all projects from Label Studio."""
        try:
            projects = self.client.list_projects()
            return [
                {
                    'id': project.id,
                    'title': project.title,
                    'description': project.description,
                    'created_at': project.created_at,
                    'task_number': getattr(project, 'task_number', 0),
                    'label_config': project.label_config if hasattr(project, 'label_config') else None,
                }
                for project in projects
            ]
        except Exception as e:
            raise Exception(f"Failed to fetch projects: {str(e)}")

    def get_project(self, project_id):
        """Get a specific project by ID."""
        try:
            project = self.client.get_project(project_id)
            return {
                'id': project.id,
                'title': project.title,
                'description': project.description,
                'created_at': project.created_at,
                'label_config': project.label_config if hasattr(project, 'label_config') else None,
                'task_number': getattr(project, 'task_number', 0),
            }
        except Exception as e:
            raise Exception(f"Failed to fetch project {project_id}: {str(e)}")

    def sync_project(self, project_id):
        """Sync tasks from a Label Studio project."""
        try:
            project = self.client.get_project(project_id)

            # Get all tasks for this project
            tasks = project.get_tasks()

            task_list = []
            for task in tasks:
                task_data = {
                    'id': task['id'],
                    'data': task.get('data', {}),
                    'annotations': task.get('annotations', []),
                    'predictions': task.get('predictions', []),
                    'created_at': task.get('created_at'),
                    'updated_at': task.get('updated_at'),
                }
                task_list.append(task_data)

            return {
                'project': {
                    'id': project.id,
                    'title': project.title,
                    'label_config': project.label_config if hasattr(project, 'label_config') else None,
                },
                'tasks': task_list
            }
        except Exception as e:
            raise Exception(f"Failed to sync project {project_id}: {str(e)}")

    def create_annotation(self, task_id, annotation_data, completed_by=None):
        """Create an annotation for a task in Label Studio."""
        try:
            # Use the SDK to create annotation
            # The exact method depends on Label Studio SDK version
            annotation = {
                'task': task_id,
                'result': annotation_data,
                'completed_by': completed_by,
            }

            # Note: This is a simplified version
            # You may need to adjust based on Label Studio SDK version
            response = self.client.make_request(
                method='POST',
                url=f'/api/tasks/{task_id}/annotations/',
                json=annotation
            )
            return response
        except Exception as e:
            raise Exception(f"Failed to create annotation for task {task_id}: {str(e)}")


def create_client_for_user(user):
    """Create a Label Studio client for a given user."""
    try:
        connection = user.labelstudio_connection
        return LabelStudioClient(
            api_url=connection.labelstudio_url,
            api_token=connection.api_token
        )
    except Exception as e:
        raise Exception(
            "User does not have a Label Studio connection configured. "
            f"Error: {str(e)}"
        )


def login_and_get_token(labelstudio_url, email, password):
    """
    Login to Label Studio with email/password and retrieve API token.
    Returns the API token if successful.
    """
    try:
        session = requests.Session()

        # Step 1: Get the login page to retrieve CSRF token
        login_page_url = f"{labelstudio_url}/user/login/"
        response = session.get(login_page_url)
        response.raise_for_status()

        # Parse CSRF token from the page
        soup = BeautifulSoup(response.text, 'html.parser')
        csrf_token = None
        csrf_input = soup.find('input', {'name': 'csrfmiddlewaretoken'})
        if csrf_input:
            csrf_token = csrf_input.get('value')

        if not csrf_token:
            # Try to get from cookies
            csrf_token = session.cookies.get('csrftoken')

        if not csrf_token:
            raise Exception("Could not retrieve CSRF token from Label Studio")

        # Step 2: Login with credentials
        login_data = {
            'csrfmiddlewaretoken': csrf_token,
            'email': email,
            'password': password,
        }

        headers = {
            'Referer': login_page_url,
            'X-CSRFToken': csrf_token,
        }

        login_response = session.post(
            login_page_url,
            data=login_data,
            headers=headers,
            allow_redirects=True
        )

        # Check if login was successful
        if login_response.status_code != 200 or 'error' in login_response.text.lower():
            raise Exception("Invalid email or password")

        # Step 3: Get the API token from the user account page
        token_url = f"{labelstudio_url}/api/current-user/token"
        token_response = session.get(token_url)
        token_response.raise_for_status()

        token_data = token_response.json()
        api_token = token_data.get('token')

        if not api_token:
            raise Exception("Could not retrieve API token after login")

        return api_token

    except requests.exceptions.RequestException as e:
        raise Exception(f"Network error connecting to Label Studio: {str(e)}")
    except Exception as e:
        raise Exception(f"Failed to login to Label Studio: {str(e)}")
