# System Architecture

## Technology Stack Overview
- **Frontend**: Next.js, TypeScript, Tailwind CSS
- **Backend**: Python, FastAPI
- **Database**: PostgreSQL
- **Authentication**: Supabase Auth

## Security Services
The backend is composed of several decoupled services, allowing for scalability and focused responsibility:
- **Identity Service**: Manages the NHI inventory and discovery.
- **Agent Service**: Manages the AI Agent registry and capabilities.
- **Risk Engine**: Evaluates context and calculates dynamic risk scores.
- **Policy Engine**: Processes rules and outputs decisions (ALLOW/BLOCK/REVIEW/ALERT).
- **Monitoring Service**: Observes incoming telemetry and tracks behavior.
- **Alert Service**: Routes notifications to external systems.
- **Audit Service**: Handles immutable logging of all events and decisions.

## Future Infrastructure Integrations
- **GitHub**: To discover CI/CD identities and code-embedded secrets.
- **AWS**: To monitor IAM roles and cloud service accounts.
- **Kubernetes**: To govern cluster service accounts and pod identities.

## Architecture Diagrams

### 1. High-Level Architecture

```mermaid
graph TD
    UI[Frontend: Next.js + Tailwind] --> API[Backend API: FastAPI]
    API --> Auth[Authentication: Supabase Auth]
    API --> DB[(Database: PostgreSQL)]
    
    subgraph Security Engines
        PE[Policy Engine]
        RE[Risk Engine]
        MS[Monitoring Service]
    end
    
    API --> PE
    API --> RE
    API --> MS
    
    subgraph Integrations
        GH[GitHub]
        AWS[AWS]
        K8S[Kubernetes]
    end
    
    MS -.-> Integrations
```

### 2. Identity-to-Resource Flow

```mermaid
sequenceDiagram
    participant NHI as Non-Human Identity
    participant API as Target Resource API
    participant NX as NEXUS Control Plane
    
    NHI->>API: Request Action
    API->>NX: Validate Action
    NX-->>NX: Check Inventory & Permissions
    NX-->>NX: Evaluate Policy
    NX-->>API: Decision (ALLOW/BLOCK)
    alt Decision is ALLOW
        API-->>NHI: Action Successful
    else Decision is BLOCK
        API-->>NHI: Access Denied
    end
```

### 3. AI-Agent Security Flow

```mermaid
graph LR
    Agent[AI Agent] --> Request[Action Request]
    Request --> Registry[Check Agent Registry]
    Registry --> Context[Gather Context/Prompt Data]
    Context --> Policy[Evaluate Tool/Action Policy]
    Policy --> Output{Decision}
    Output -->|ALLOW| Exec[Execute Tool]
    Output -->|BLOCK| Halt[Halt Execution]
```

### 4. Risk Evaluation Flow

```mermaid
graph TD
    Event[Action Event] --> ID[Identify Actor]
    Event --> Target[Identify Target Resource]
    ID --> Hist[Fetch Historical Behavior]
    Target --> Sens[Assess Resource Sensitivity]
    Hist --> Calc[Calculate Risk Score]
    Sens --> Calc
    Calc --> Policy[Send to Policy Engine]
```

### 5. Policy Enforcement Flow

```mermaid
graph TD
    Input[Context + Risk Score] --> Rules[Load Enterprise Ruleset]
    Rules --> Eval{Condition Met?}
    Eval -->|Safe| Allow[ALLOW]
    Eval -->|Unsafe| Block[BLOCK]
    Eval -->|Uncertain| Review[REVIEW]
    Eval -->|Suspicious| Alert[ALERT]
    Allow --> Audit[(Audit Log)]
    Block --> Audit
    Review --> Audit
    Alert --> Audit
```
