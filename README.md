# 📈 StockIQ — Smart Market Intelligence Platform

A real-time stock monitoring and alert system with live price updates, email notifications, and comprehensive authentication. Built with **React 19 + Vite** (frontend) and **.NET 10 + SignalR + PostgreSQL** (backend).

---

## ✨ Features

- 🔐 Secure authentication with JWT & OTP email verification
- 📊 Real-time stock price updates via SignalR
- 🔔 Price alerts with email notifications
- 📈 260+ stocks with simulated live prices
- 🎨 Modern dark-themed UI
- 🔒 Password reset flow
- 🛡️ Rate limiting & security middleware
- 📚 API documentation with Swagger
- 🐳 Docker support

---

## 🚀 Quick Start

See [SETUP.md](./SETUP.md) for detailed setup instructions.

### Prerequisites
- **.NET 10 SDK** ([download](https://dotnet.microsoft.com/download))
- **Node.js 18+** ([download](https://nodejs.org))
- **PostgreSQL 14+** ([download](https://www.postgresql.org/download/))

### 1. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your configuration

cd StockApi
dotnet restore
dotnet ef database update
dotnet run
```

Backend runs at **http://localhost:5000**
- API: http://localhost:5000/api
- Swagger: http://localhost:5000/swagger
- SignalR Hub: http://localhost:5000/stockhub

### 2. Frontend Setup

```bash
cd frontend
cp .env.example .env
# Edit .env with backend URL

npm install
npm run dev
```

Frontend runs at **http://localhost:5173**

---

## 🐳 Docker Deployment

```bash
# Build and run all services
docker-compose up --build

# Run in background
docker-compose up -d
```

| Service  | URL                     |
|----------|-------------------------|
| Frontend | http://localhost:3000    |
| Backend  | http://localhost:5000    |
| Swagger  | http://localhost:5000/swagger |

---

## 📁 Project Structure

```
stock-project/
├── frontend/               # React 19 + Vite
│   ├── src/
│   │   ├── App.jsx         # Main dashboard
│   │   ├── StockDashboard.jsx  # Stock monitoring UI
│   │   ├── context.jsx     # Auth + Alerts context
│   │   ├── data.js         # Stock database
│   │   ├── useStockHub.js  # SignalR connection
│   │   └── main.jsx
│   ├── Dockerfile
│   └── nginx.conf
├── backend/
│   └── StockApi/
│       ├── Program.cs      # API entry
│       ├── Controllers/
│       │   ├── AuthController.cs    # Auth endpoints
│       │   └── AlertsController.cs  # Alert management
│       ├── Hubs/StockHub.cs         # SignalR hub
│       ├── Models/                  # Data models
│       ├── Services/                # Background services
│       ├── Middleware/              # Security middleware
│       └── Data/AppDbContext.cs     # EF Core context
├── docker-compose.yml
├── SETUP.md               # Detailed setup guide
├── SECURITY.md            # Security documentation
└── README.md
```

---

## 🔐 Security Features

- JWT authentication with configurable expiry
- Password complexity validation
- Account lockout after failed attempts
- OTP email verification
- Password reset with secure tokens
- Rate limiting (100 req/min)
- CORS whitelist configuration
- Global error handling
- Audit logging

See [SECURITY.md](./SECURITY.md) for complete security documentation.

---

## 📚 API Documentation

Once the backend is running, visit:
- **Swagger UI**: http://localhost:5000/swagger
- **Health Check**: http://localhost:5000/health

### Key Endpoints

**Authentication**
- `POST /api/auth/send-otp` - Send OTP to email
- `POST /api/auth/register` - Register with OTP
- `POST /api/auth/login` - Login
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password
- `GET /api/auth/me` - Get current user

**Alerts**
- `GET /api/alerts` - Get user alerts (paginated)
- `POST /api/alerts` - Create alert
- `PUT /api/alerts/{id}` - Update alert
- `DELETE /api/alerts/{id}` - Delete alert
- `POST /api/alerts/bulk-delete` - Delete multiple alerts

**SignalR Hub**
- `/stockhub` - Real-time price updates

---

## ⚙️ Environment Variables

### Backend (.env)
```bash
JWT_SECRET=your-super-secret-key-min-32-chars
DATABASE_URL=Host=localhost;Database=stockiq;Username=postgres;Password=postgres
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

### Frontend (.env)
```bash
VITE_API_URL=http://localhost:5000
```

See [SETUP.md](./SETUP.md) for complete environment variable reference.

---

## 🧪 Development

### Database Migrations

```bash
cd backend/StockApi

# Create migration
dotnet ef migrations add MigrationName

# Apply migrations
dotnet ef database update
```

### Install Dependencies

```bash
# Backend
cd backend/StockApi
dotnet restore

# Frontend
cd frontend
npm install
```

---

## 🌐 Production Deployment

### Security Checklist
- [ ] Set strong `JWT_SECRET` (min 32 chars)
- [ ] Configure production `CORS_ORIGINS`
- [ ] Set `ASPNETCORE_ENVIRONMENT=Production`
- [ ] Enable HTTPS
- [ ] Configure SMTP for emails
- [ ] Set up database backups
- [ ] Review [SECURITY.md](./SECURITY.md)

### Build

```bash
# Backend
cd backend/StockApi
dotnet publish -c Release -o ./publish

# Frontend
cd frontend
npm run build
```

---

## 📝 Notes

- Stock prices are **simulated** for demo purposes
- Email notifications require SMTP configuration
- For Gmail SMTP, use App Passwords (not regular password)
- SignalR requires JWT authentication
- See [SETUP.md](./SETUP.md) for troubleshooting

---

## 📄 License

MIT License - feel free to use for your projects!

---

## 🤝 Contributing

Contributions welcome! Please read [SECURITY.md](./SECURITY.md) for security guidelines.
