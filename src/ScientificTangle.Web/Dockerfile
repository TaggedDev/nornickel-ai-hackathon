FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["ScientificTangle.Web/ScientificTangle.Web.csproj", "ScientificTangle.Web/"]
COPY ["ScientificTangle.Application/ScientificTangle.Application.csproj", "ScientificTangle.Application/"]
COPY ["ScientificTangle.Contracts/ScientificTangle.Contracts.csproj", "ScientificTangle.Contracts/"]
COPY ["ScientificTangle.Infrastructure/ScientificTangle.Infrastructure.csproj", "ScientificTangle.Infrastructure/"]
COPY ["ScientificTangle.Core/ScientificTangle.Core.csproj", "ScientificTangle.Core/"]
RUN dotnet restore "ScientificTangle.Web/ScientificTangle.Web.csproj"

COPY . .
WORKDIR "/src/ScientificTangle.Web"
RUN dotnet publish -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Development
COPY --from=build /app .
ENTRYPOINT ["dotnet", "ScientificTangle.Web.dll"]
