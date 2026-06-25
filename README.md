# PulseTriage Backend

The robust backend API for PulseTriage, an AI-driven multi-agent helpdesk system designed for scalable, real-time customer support.

## 🚀 Features

- **Real-Time Collaboration**: Built with Socket.io to enable seamless agent communication and live ticket status updates.
- **Collision Prevention**: Robust ticket locking mechanism to prevent multiple agents from working on the same issue simultaneously.
- **SLA Escalation Engine**: Automated, high-performance queues using Redis and BullMQ to handle critical incident escalation.
- **Email Notifications**: Integrated Nodemailer for sending automated escalation alerts to administrators.
- **Secure & Role-Based**: Mongoose schemas designed for secure, role-based access control and optimized querying.

## 🛠️ Tech Stack

- **Runtime**: [Node.js](https://nodejs.org/)
- **Framework**: [Express.js](https://expressjs.com/)
- **Database**: [MongoDB](https://www.mongodb.com/) (with [Mongoose](https://mongoosejs.com/))
- **Real-Time**: [Socket.io](https://socket.io/)
- **Queues & Caching**: [Redis](https://redis.io/) & [BullMQ](https://docs.bullmq.io/)
- **Emails**: [Nodemailer](https://nodemailer.com/)

## ⚙️ Prerequisites

- Node.js (v18+ recommended)
- MongoDB running locally or a MongoDB Atlas connection string
- Redis server running locally or remotely

## 🚦 Getting Started

1. **Clone the repository:**
   ```bash
   git clone https://github.com/ehteysham10/PulseTriage-Backend.git
   cd PulseTriage-Backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Setup:**
   Create a `.env` file in the root directory and configure the necessary variables (refer to `.env.example` if available). Basic requirements usually include:
   ```env
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   REDIS_HOST=127.0.0.1
   REDIS_PORT=6379
   JWT_SECRET=your_jwt_secret
   SMTP_HOST=your_smtp_host
   SMTP_PORT=your_smtp_port
   SMTP_USER=your_smtp_user
   SMTP_PASS=your_smtp_password
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

## 📜 License

This project is licensed under the MIT License.