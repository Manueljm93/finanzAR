FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY src/Shared/FinanzasAR.SharedKernel/FinanzasAR.SharedKernel.csproj src/Shared/FinanzasAR.SharedKernel/
COPY src/Services/Monotributo.API/FinanzasAR.Monotributo.API.csproj src/Services/Monotributo.API/
RUN dotnet restore src/Services/Monotributo.API/FinanzasAR.Monotributo.API.csproj
COPY src/Shared/FinanzasAR.SharedKernel/ src/Shared/FinanzasAR.SharedKernel/
COPY src/Services/Monotributo.API/ src/Services/Monotributo.API/
RUN dotnet publish src/Services/Monotributo.API/FinanzasAR.Monotributo.API.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "FinanzasAR.Monotributo.API.dll"]
