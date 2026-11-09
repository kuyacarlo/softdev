# SoftDev

A repository for storage of requirements for partial fulfilment of Software Design Course (CPE 304/304L). At the moment, this houses the submission for various activities in markdown form.

## Repository Contents
- **[docs/01-system-architecture/](docs/01-system-architecture)**: Contains system architecture and UML specifications ([01SystemArchitecture.md](docs/01-system-architecture/01SystemArchitecture.md) & [01SystemArchitectureUML.md](docs/01-system-architecture/01SystemArchitectureUML.md)).
  - **[system_architecture_deck.md](docs/01-system-architecture/system_architecture_deck.md)**: A Marp-based presentation summarizing the system design and UML components.
- **[docs/02-requirements-workshop/](docs/02-requirements-workshop)**: Contains the Requirements Engineering Workshop activity details ([requirements_engineering_workshop.md](docs/02-requirements-workshop/requirements_engineering_workshop.md)).
  - **[requirements_engineering_workshop_deck.md](docs/02-requirements-workshop/requirements_engineering_workshop_deck.md)**: A Marp-based presentation summarizing the requirements workshop.
- **[docs/03-srs/](docs/03-srs/)**: Software Requirements Specifications for all three systems, one file per system:
  - **[srs-client-stella-catering.md](docs/03-srs/srs-client-stella-catering.md)**: Stella's Event Management Services Website (client system) — converted from the client's PDF requirements and reformatted to the CPE 304/304L SRS template.
  - **[srs-study-pod.md](docs/03-srs/srs-study-pod.md)**: Study Pod Reservation System.
  - **[srs-campus-logistics.md](docs/03-srs/srs-campus-logistics.md)**: Smart Campus Logistics System (document custody & approval tracker) — formalizes the Requirements Engineering Workshop problem statement.
- **[docs/04-system-engineering-blueprint/](docs/04-system-engineering-blueprint)**: Midterm System Engineering Blueprint, including the client counterpart specification for Casa de Stella Catering Services.
- **[docs/05-tech-stack-and-deployment/](docs/05-tech-stack-and-deployment)**: Architecture/scaffolding notes, backend constraints and OpenAPI plan, and deployment pitfalls/mitigations for the implemented system.
- **[docs/06-ux-evaluation/](docs/06-ux-evaluation)**: Activity No. 5 – UX Evaluation and Refinement of the Casa de Stella client system ([ux_evaluation_stella_client_system.md](docs/06-ux-evaluation/ux_evaluation_stella_client_system.md) and a submission-ready `.docx`), with annotated evidence screenshots in `evidence/`.
- **[docs/07-final-project/](docs/07-final-project)**: CPE 304L Course Final Project technical report for the Casa de Stella client system ([CPE304L_Project_Grp2-1.docx](docs/07-final-project/CPE304L_Project_Grp2-1.docx)) with traceability matrix, architecture, backend evidence and touch-target audit; annotated screenshots in `img/`.
- **[lib/](lib)**: Central Marp compilation backend containing symlinks to the presentation decks in `lib/src/`.
