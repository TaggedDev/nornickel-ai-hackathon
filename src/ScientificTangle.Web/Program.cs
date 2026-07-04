using Microsoft.AspNetCore.DataProtection;
using ScientificTangle.Infrastructure;
using ScientificTangle.Infrastructure.Identity;
using ScientificTangle.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    ContentRootPath = AppContext.BaseDirectory
});
builder.Configuration.AddUserSecrets<Program>(optional: true);
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddDebug();

builder.Services.AddDataProtection()
    .SetApplicationName("ScientificTangle")
    .PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(AppContext.BaseDirectory, "DataProtectionKeys")));
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddControllers();
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend",
        policy =>
        {
            policy.WithOrigins("http://localhost:5173").AllowAnyHeader().AllowAnyMethod().AllowCredentials();
        });
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}
app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    await services.ApplyDatabaseMigrationsAsync();

    var roleManager = services.GetRequiredService<Microsoft.AspNetCore.Identity.RoleManager<ApplicationRole>>();
    await RoleSeeder.SeedAsync(roleManager);
}

app.Run();
