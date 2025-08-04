# Legacy config file - kept for compatibility
# New configuration is in config/ directory

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
load_dotenv('.env.development')  # Load development config if exists

# Import new configuration system
from config import config, DevelopmentConfig

# Use the new config system
Config = config.get(os.getenv('FLASK_ENV', 'development'), DevelopmentConfig)
