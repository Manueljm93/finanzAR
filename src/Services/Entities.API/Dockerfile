FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY src/Shared/FinanzasAR.SharedKernel/FinanzasAR.SharedKernel.csproj src/Shared/FinanzasAR.SharedKernel/
COPY src/Services/Entities.API/FinanzasAR.Entities.API.csproj src/Services/Entities.API/
RUN dotnet restore src/Services/Entities.API/FinanzasAR.Entities.API.csproj
COPY src/Shared/FinanzasAR.SharedKernel/ src/Shared/FinanzasAR.SharedKernel/
COPY src/Services/Entities.API/ src/Services/Entities.API/
RUN dotnet publish src/Services/Entities.API/FinanzasAR.Entities.API.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "FinanzasAR.Entities.API.dll"]
