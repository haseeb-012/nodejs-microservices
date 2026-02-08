# RabbitMQ Message Queue Demo - Microservices Example

## 📋 Project Overview
A simple demonstration of how **RabbitMQ** works as a message broker between microservices. This project shows the **Producer-Consumer pattern** in action with three services communicating via message queues.

## 🏗️ Architecture
```
┌─────────────┐     ┌─────────────┐     ┌───────────────┐
│   Task      │────▶│   RabbitMQ  │────▶│  Notification │
│  Service    │     │   (Queue)   │     │   Consumer    │
│  (Producer) │     └─────────────┘     │  (Consumer)   │
└─────────────┘                         └───────────────┘
       │                                       │
       ▼                                       ▼
┌─────────────┐                         (Console Logs)
│   MongoDB   │                         (Notifications)
└─────────────┘
```

## 🚀 Services

### 1. **User Service** (`http://localhost:3000`)
- Basic user management (Create, Read users)
- REST API endpoints
- **Technology**: Express + MongoDB

### 2. **Task Service** (`http://localhost:3002`)
- Task management (Create, Read tasks)
- **PRODUCER**: Publishes messages to RabbitMQ when tasks are created
- **Technology**: Express + MongoDB + RabbitMQ Publisher

### 3. **Notification Consumer** (`http://localhost:3003`)
- **CONSUMER**: Listens to RabbitMQ queue for new tasks
- Processes messages and logs notifications to console
- **Technology**: Express + RabbitMQ Consumer

### 4. **RabbitMQ** (`http://localhost:15672`)
- Message broker with management UI
- Queue: `task_created`
- **Credentials**: guest/guest

## 📦 Tech Stack
- **Node.js** + **Express** - Backend services
- **MongoDB** - Database
- **RabbitMQ** - Message broker
- **Docker** - Containerization
- **Docker Compose** - Orchestration

## 🛠️ Setup & Installation

### Prerequisites
- Docker & Docker Compose
- Git

### Quick Start
```bash
# 1. Clone the project
git clone <repository-url>
cd nodejs-microservices

# 2. Start all services
docker-compose up --build