# Project Roadmap

The development of NEXUS is divided into sequential phases, moving from foundational architecture to advanced machine learning integrations.

## Phase 0: Research and Architecture
- **Objectives**: Define the problem space, design the system architecture, and establish documentation.
- **Expected Output**: Core documentation (`README.md`, `AGENTS.md`, architecture diagrams, threat model).
- **Dependencies**: None. *(Currently Complete)*

## Phase 1: Project Foundation
- **Objectives**: Scaffold the frontend and backend applications, set up the database, and establish the development environment.
- **Major Components**: Next.js app structure, FastAPI skeleton, Supabase integration, Docker setup.
- **Expected Output**: A running MVP framework with authentication and a basic Command Center UI.
- **Dependencies**: Phase 0.

## Phase 2: NHI Inventory
- **Objectives**: Build the core identity registry for standard non-human identities.
- **Major Components**: Identity Service, Database schemas, CRUD UI for identities.
- **Expected Output**: Ability to manually add, view, and manage API keys and service accounts.
- **Dependencies**: Phase 1.

## Phase 3: AI Agent Registry
- **Objectives**: Extend the inventory to support autonomous AI agents.
- **Major Components**: Agent Service, metadata tracking for capabilities and tool access.
- **Expected Output**: Dedicated dashboard for AI agents and their configurations.
- **Dependencies**: Phase 2.

## Phase 4: Risk Engine
- **Objectives**: Implement the core logic for calculating dynamic risk scores.
- **Major Components**: Risk calculation algorithms, contextual evaluation models.
- **Expected Output**: Each identity and proposed action receives a quantifiable risk score.
- **Dependencies**: Phase 2 & 3.

## Phase 5: Policy Engine
- **Objectives**: Build the centralized ruleset evaluator.
- **Major Components**: Rule definition syntax, evaluation engine, enforcement API.
- **Expected Output**: The system can issue ALLOW, BLOCK, REVIEW, or ALERT decisions based on defined rules.
- **Dependencies**: Phase 4.

## Phase 6: Behavior Monitoring
- **Objectives**: Begin tracking and establishing baselines for NHI activity.
- **Major Components**: Monitoring Service, telemetry ingestion, baseline calculation.
- **Expected Output**: Statistical tracking of normal operational behavior.
- **Dependencies**: Phase 5.

## Phase 7: Alerts and Audit
- **Objectives**: Ensure complete traceability and notification capabilities.
- **Major Components**: Audit Service, immutable logging, alerting integrations (email, Slack/Teams).
- **Expected Output**: Comprehensive audit logs and real-time security alerts.
- **Dependencies**: Phase 5.

## Phase 8: Access Graph
- **Objectives**: Visually map the relationships between identities and resources.
- **Major Components**: Graph data structures, UI visualization tools.
- **Expected Output**: An interactive map showing "Who has access to What."
- **Dependencies**: Phase 2 & 3.

## Phase 9: GitHub Integration (Future Scope)
- **Objectives**: Automatically discover CI/CD identities and secrets in GitHub.
- **Major Components**: GitHub API integration, automated scanning.
- **Dependencies**: Phase 2.

## Phase 10: AWS Integration (Future Scope)
- **Objectives**: Map AWS IAM roles and cloud service accounts.
- **Major Components**: AWS IAM API integration, permission analysis.
- **Dependencies**: Phase 2.

## Phase 11: Kubernetes Integration (Future Scope)
- **Objectives**: Manage cluster service accounts and pod-to-pod identities.
- **Major Components**: Kubernetes RBAC integration.
- **Dependencies**: Phase 2.

## Phase 12: ML Anomaly Detection (Future Scope)
- **Objectives**: Upgrade the Behavioral Monitoring with advanced machine learning.
- **Major Components**: Python ML microservice (Scikit-learn, Isolation Forests).
- **Expected Output**: Highly accurate, dynamic anomaly detection.
- **Dependencies**: Phase 6.

## Phase 13: Security Testing
- **Objectives**: Penetration testing and security validation of the NEXUS platform itself.
- **Dependencies**: Phase 7.

## Phase 14: Deployment
- **Objectives**: Production-ready deployment.
- **Major Components**: CI/CD pipelines, production infrastructure provisioning.
