# Code example of typeScript with Nest.js as part of my RemoteDatabase implementation
The main Goal of this implementation it's collect all cutomers data from **remote datacenters** (not from current DC) as one main single database (Because there some law regulation and restricts users data access in some customers countries).

- remoteDb.model.ts --> model of Objection ORM
- remoteDataBase.repository.ts -->  the main method for operate with database
- remoteDb.service.ts --> main module with logic to implement task
- app.module.ts --> main nest.js framework app code file
