# Hosting Panel

A modern, black and white themed hosting panel with email/password authentication and Pterodactyl integration.

## Features

- ✅ **Email/Password Authentication** - Secure login and registration system
- ✅ **Modern Black & White Theme** - Clean, elegant UI with glassmorphism effects
- ✅ **Server Management** - Create, modify, and delete servers via Pterodactyl API
- ✅ **Resource Tracking** - Monitor RAM, CPU, disk, and server slots
- ✅ **Coin System** - Built-in virtual currency for resource purchases
- ✅ **User Dashboard** - Comprehensive overview of resources and servers

## Installation

1. Install dependencies:
```bash
npm install
```

2. Configure your Pterodactyl panel in `settings.json`:
```json
{
  "pterodactyl": {
    "domain": "https://your-panel.com",
    "key": "your-api-key"
  }
}
```

3. Start the application:
```bash
npm start
```

The application will be available at `http://localhost:3000`

## Configuration

Edit `settings.json` to customize:

- **Package Limits**: Adjust default resource limits in `api.client.packages.list`
- **Locations**: Configure server locations in `api.client.locations`
- **Server Types**: Add or modify server eggs in `api.client.eggs`
- **Coin Store**: Set prices for resource purchases in `api.client.coins.store`

## Features Overview

### Authentication
- Email-based registration and login
- Password encryption with bcrypt
- Session management
- "Remember Me" functionality

### Dashboard
- Resource usage tracking
- Server status monitoring
- Coin balance display
- Quick server actions

### Server Management
- Create servers with custom specifications
- Modify resource limits
- Delete servers
- Location-based deployment

### Security
- Input validation
- XSS protection
- CSRF protection via sessions
- Secure password storage

## API Endpoints

- `GET /` - Landing page
- `GET /login` - Login page
- `POST /login` - Handle login
- `GET /register` - Registration page
- `POST /register` - Handle registration
- `GET /logout` - Logout user
- `GET /dashboard` - User dashboard
- `GET /servers` - Server list
- `GET /servers/new` - Create server page
- `GET /create` - Create server endpoint
- `GET /edit` - Edit server endpoint
- `GET /delete` - Delete server endpoint

## Requirements

- Node.js 14+
- Pterodactyl Panel with API access
- SQLite database (automatically created)

## Theme

The panel uses a modern black and white theme with:
- Matte black backgrounds (#0a0a0a, #050505)
- White text and accents
- Clean, minimal design
- Smooth animations and transitions
- Responsive layout for mobile and desktop

## License

See LICENSE file for details.
