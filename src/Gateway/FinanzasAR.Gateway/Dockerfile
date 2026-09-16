FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY src/Shared/FinanzasAR.SharedKernel/FinanzasAR.SharedKernel.csproj src/Shared/FinanzasAR.SharedKernel/
COPY src/Gateway/FinanzasAR.Gateway/FinanzasAR.Gateway.csproj src/Gateway/FinanzasAR.Gateway/
RUN dotnet restore src/Gateway/FinanzasAR.Gateway/FinanzasAR.Gateway.csproj
COPY src/Shared/FinanzasAR.SharedKernel/ src/Shared/FinanzasAR.SharedKernel/
COPY src/Gateway/FinanzasAR.Gateway/ src/Gateway/FinanzasAR.Gateway/
RUN dotnet publish src/Gateway/FinanzasAR.Gateway/FinanzasAR.Gateway.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "FinanzasAR.Gateway.dll"]
