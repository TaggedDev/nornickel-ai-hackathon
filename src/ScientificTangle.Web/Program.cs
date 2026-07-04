using Microsoft.EntityFrameworkCore;
using ScientificTangle.Infrastructure;
using ScientificTangle.Infrastructure.Identity;
using ScientificTangle.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddControllers();
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend",
        policy => { policy.WithOrigins("http://localhost:5173").AllowAnyHeader().AllowAnyMethod().AllowCredentials(); });
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var dbContext = services.GetRequiredService<ScientificTangleIdentityDbContext>();
    await dbContext.Database.EnsureCreatedAsync();

    var roleManager = services.GetRequiredService<Microsoft.AspNetCore.Identity.RoleManager<ApplicationRole>>();
    await RoleSeeder.SeedAsync(roleManager);
}

app.Run();
