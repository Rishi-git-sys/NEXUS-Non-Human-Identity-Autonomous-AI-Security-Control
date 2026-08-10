# NEXUS
## Non-Human Identity & Autonomous AI Security Governance Platform

### 1. Overview
NEXUS is an enterprise security control plane designed to discover, monitor, assess, govern, and control non-human identities (NHIs) and autonomous AI agents operating across modern IT infrastructure.

### 2. Problem Statement
The proliferation of machine identities (API keys, service accounts, microservices, and AI agents) has created a significant security blind spot. Organizations often lack centralized visibility into these identities, which are frequently granted excessive permissions and are highly vulnerable to credential theft or autonomous misbehavior.

### 3. Proposed Solution
NEXUS provides a centralized platform to manage the lifecycle and behavior of NHIs and AI agents. It integrates discovery, risk scoring, behavioral monitoring, and policy enforcement to ensure all non-human actions are authorized, legitimate, and safe.

### 4. Project Objectives
- Provide complete visibility into NHIs and AI agents.
- Establish baseline behavioral models for non-human entities.
- Enforce least privilege and zero-trust principles automatically.
- Provide a clear, auditable trail of all automated actions.

### 5. Core Security Questions
NEXUS aims to answer four fundamental questions for every automated action:
1. **WHO** is acting?
2. **WHAT** can it access?
3. **WHAT** is it actually doing?
4. **SHOULD** that action be allowed?

### 6. Key Features & Status
- **NHI Management** *(UI Implemented, Mock Integrated)*: Inventory, search, filtering, and detail view of non-human identities (API keys, service accounts, Cloud IAM, CI/CD).
- **AI Agent Security** *(UI Implemented, Mock Integrated)*: Dedicated registry to monitor autonomous AI agents, their base LLMs, execution modes, and allowed tools.
- **Risk Engine** *(UI Implemented, Mock Integrated)*: Dynamic risk scoring dashboard showcasing security posture metrics and trend charts (built with Recharts).
- **Policy Engine** *(UI Implemented, Mock Integrated)*: Centralized interface displaying governance policies and active enforcement actions (ALLOW, BLOCK, REVIEW, ALERT).
- **Access Graph** *(UI Implemented, Mock Integrated)*: Visual map representation tracking relationships between identities, agents, and target resources.
- **Command Center & Crawler Simulator** *(UI Implemented, Mock Integrated)*: Operations console to run discovery scans, trigger audit events, and observe real-time telemetry simulator.
- **Alerting & Auditing** *(UI Implemented, Mock Integrated)*: Security incident feeds showing alert severity (Critical, High, Medium, Low) and comprehensive, immutable audit trail logs.
- **Behavioral Monitoring** *(Planned)*: Continuous observation of NHI activities to detect anomalous operations.

### 7. NHI Management
Discovers and tracks API keys, service accounts, Cloud IAM roles, CI/CD identities, and more, maintaining a detailed inventory of permissions and usage.

### 8. AI Agent Security
A specialized module for tracking autonomous AI agents, monitoring their capabilities, tool usage, and prompt-driven actions to prevent abuse or unintended consequences.

### 9. Risk Engine
Calculates dynamic risk scores by evaluating identity privileges, historical behavior, and the sensitivity of target resources.

### 10. Policy Engine
Evaluates every action against organizational security policies, resulting in one of four decisions: **ALLOW**, **BLOCK**, **REVIEW**, or **ALERT**.

### 11. Behavioral Monitoring
*Planned for a future phase.* Will use anomaly detection techniques to identify deviations from normal NHI and agent behavior.

### 12. Alerting and Audit
Maintains an immutable audit log of all decisions and generates alerts for high-risk or blocked actions.

### 13. System Architecture
NEXUS uses a modular, decoupled architecture separating the frontend UI, backend services, and core security evaluation engines. *(See [docs/architecture.md](docs/architecture.md) for details)*.

### 14. Technology Stack
- **Frontend**: Next.js, TypeScript, Tailwind CSS
- **Backend**: Python, FastAPI
- **Database**: PostgreSQL (with Supabase for development)
- **Infrastructure**: Docker, GitHub Actions, AWS, Kubernetes

### 15. Planned Integrations
- GitHub
- AWS
- Kubernetes

### 16. Example Security Scenario
1. `DevOps-Agent` attempts to execute a `DELETE` operation on `production_database`.
2. NEXUS identifies the agent and checks its permissions.
3. The Risk Engine evaluates the behavior and context.
4. The Policy Engine reviews the ruleset for this environment.
5. NEXUS issues a **BLOCK** decision.
6. An alert is generated and an audit record is created.

### 17. Project Roadmap
See [docs/roadmap.md](docs/roadmap.md) for the detailed phased development approach.

### 18. Project Structure
- `/app`: Next.js routing, layout structure, global styles, and page controllers (Dashboard, NHI, AI Agents, Policies, Alerts, Audit logs, Command Center, Access Graph, Auth).
- `/components`: Component-driven architecture including global layout elements (`Sidebar`, `TopBar`), dashboard components (`KPICard`), and generic UI elements (`RiskGauge`, `RiskTrendChart`, badges, feeds).
- `/context`: Global React contexts (`AuthContext` with mock support/Supabase client hooks, `NavigationContext`).
- `/docs`: Foundational architecture specifications, threat models, project statements, and roadmaps.
- `/lib`: Supabase initialization wrappers, mock datasets (`/lib/mock`), service endpoints (`/lib/services`), and common utilities.
- `/types`: TypeScript interface definitions.

### 19. Security Principles
- Secure by default
- Least privilege
- Zero Trust
- Comprehensive auditability

### 20. Future Enhancements
- Advanced ML-based anomaly detection (Isolation Forests).
- Deep API integrations with GitHub, AWS, and Kubernetes.
- Interactive d3/graph layouts for the Access Graph dashboard.

### 21. Development Status
**Current Phase: Phase 1 (Project Foundation) - Frontend Complete, Database-Ready**
The NEXUS frontend platform has been scaffolded and fully built using **Next.js 16.3 (TypeScript)** and **Tailwind CSS v4**. 
- A custom UI design system was developed, featuring dark-mode layouts, responsive navigation, metric dashboards, and audit visualizers.
- A client-side services layer and mock database engine were created to simulate operations, scan triggers, security alerts, and policies.
- Authentication pages (login, signup, password resets) are integrated with **Supabase Auth** client contexts, ready for backend deployment.
The next step is backend engineering (FastAPI) and connecting active database tables to replace mock datasets.

### 22. License
[MIT License](LICENSE) *(Placeholder)*
