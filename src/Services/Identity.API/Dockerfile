FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY src/Shared/FinanzasAR.SharedKernel/FinanzasAR.SharedKernel.csproj src/Shared/FinanzasAR.SharedKernel/
COPY src/Services/Identity.API/FinanzasAR.Identity.API.csproj src/Services/Identity.API/
RUN dotnet restore src/Services/Identity.API/FinanzasAR.Identity.API.csproj
COPY src/Shared/FinanzasAR.SharedKernel/ src/Shared/FinanzasAR.SharedKernel/
COPY src/Services/Identity.API/ src/Services/Identity.API/
RUN dotnet publish src/Services/Identity.API/FinanzasAR.Identity.API.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "FinanzasAR.Identity.API.dll"]
