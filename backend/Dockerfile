# ── Build stage ──
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY StockApi/StockApi.csproj StockApi/
RUN dotnet restore StockApi/StockApi.csproj

COPY StockApi/ StockApi/
WORKDIR /src/StockApi
RUN dotnet publish -c Release -o /app/publish

# ── Runtime stage ──
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

COPY --from=build /app/publish .

# Railway injects PORT env var automatically
ENV PORT=8080
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "StockApi.dll"]
