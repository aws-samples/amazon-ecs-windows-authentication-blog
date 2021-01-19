// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Microsoft.Data.SqlClient;
using web_site.Models;
using Microsoft.Extensions.Configuration;

namespace web_site.Controllers
{
    public class HomeController : Controller
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<HomeController> _logger;

        public HomeController(IConfiguration configuration, ILogger<HomeController> logger)
        {
            _configuration = configuration;
            _logger = logger;
        }

        public IActionResult Index()
        {
            var albums = this.GetAlbums();
            this.ViewBag.Albums = albums;
            return View();
        }

        public IActionResult Privacy()
        {
            return View();
        }

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult HealthCheck()
        {
            return this.Ok("Healthy");
        }

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error()
        {
            return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
        }

        protected List<string> GetAlbums()
        {
            var result = new List<string>();
            var count = 5;

            var connectionString = _configuration.GetConnectionString("Chinook");
            using (var connection = new SqlConnection(connectionString))
            {
                var command = new SqlCommand($"SELECT TOP {count} * FROM dbo.Album ORDER BY NEWID()", connection);
                connection.Open();
                using (var reader = command.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        result.Add(reader[1].ToString());
                    }
                }
            }

            return result.ToList();
        }
    }
}
