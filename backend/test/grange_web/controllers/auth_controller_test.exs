defmodule GrangeWeb.AuthControllerTest do
  @moduledoc false
  use GrangeWeb.ConnCase, async: false

  alias Grange.{Accounts, FarmStore}

  @alice %{
    "username" => "Alice",
    "email" => "alice@example.test",
    "password" => "harvest-please"
  }

  setup do
    Accounts.reset()
    FarmStore.reset()
    :ok
  end

  defp json_post(conn, path, params) do
    conn
    |> put_req_header("content-type", "application/json")
    |> post(path, Jason.encode!(params))
  end

  defp session_cookie(conn) do
    conn
    |> get_resp_header("set-cookie")
    |> Enum.find(&String.starts_with?(&1, "_grange_key="))
  end

  defp register(conn \\ build_conn()),
    do: json_post(conn, "/api/auth/register", @alice)

  test "register creates the user and sets an httpOnly SameSite=Lax cookie" do
    conn = register()

    assert %{"ok" => true, "user" => %{"username" => "Alice"}} =
             json_response(conn, 201)

    cookie = session_cookie(conn)
    assert cookie
    assert cookie =~ "HttpOnly"
    assert cookie =~ "SameSite=Lax"
  end

  test "register rejects duplicate credentials with 400" do
    register()
    conn = register()

    assert %{"ok" => false} = json_response(conn, 400)
  end

  test "login with valid credentials sets the session cookie" do
    register()

    conn =
      json_post(build_conn(), "/api/auth/login", %{
        "username" => "Alice",
        "password" => "harvest-please"
      })

    assert %{"ok" => true, "user" => %{"username" => "Alice"}} =
             json_response(conn, 200)

    assert session_cookie(conn) =~ "HttpOnly"
  end

  test "login with a wrong password is 401 and sets no cookie" do
    register()

    conn =
      json_post(build_conn(), "/api/auth/login", %{
        "username" => "Alice",
        "password" => "wrong-password"
      })

    assert %{"ok" => false} = json_response(conn, 401)
    refute session_cookie(conn)
  end

  test "login as an unknown user is 401" do
    conn =
      json_post(build_conn(), "/api/auth/login", %{
        "username" => "Nobody",
        "password" => "whatever-123"
      })

    assert %{"ok" => false} = json_response(conn, 401)
  end

  test "me is 401 when signed out" do
    conn = get(build_conn(), "/api/auth/me")

    assert %{"ok" => false} = json_response(conn, 401)
  end

  test "me returns the user when the session cookie is presented" do
    conn = register() |> recycle()

    assert %{"ok" => true, "user" => %{"username" => "Alice"}} =
             json_response(get(conn, "/api/auth/me"), 200)
  end

  test "logout clears the session so me is 401 afterwards" do
    conn = register() |> recycle()

    conn = json_post(conn, "/api/auth/logout", %{}) |> recycle()

    assert %{"ok" => false} = json_response(get(conn, "/api/auth/me"), 401)
  end

  test "unmatched /api routes return a JSON 404" do
    conn = get(build_conn(), "/api/auth/regiter")

    assert %{"ok" => false} = json_response(conn, 404)

    assert conn
           |> get_resp_header("content-type")
           |> List.first()
           |> String.contains?("application/json")
  end

  test "register, login, and me report the opening balance" do
    conn = register()
    assert %{"user" => %{"balance" => 100}} = json_response(conn, 201)

    me = conn |> recycle() |> get("/api/auth/me")
    assert %{"user" => %{"balance" => 100}} = json_response(me, 200)

    login =
      json_post(build_conn(), "/api/auth/login", %{
        "username" => "Alice",
        "password" => "harvest-please"
      })

    assert %{"user" => %{"balance" => 100}} = json_response(login, 200)
  end

  test "balance transactions require a session" do
    conn = json_post(build_conn(), "/api/economy/transaction", %{"delta" => -10})
    assert %{"ok" => false} = json_response(conn, 401)
  end

  test "a signed-in account can spend and earn" do
    conn = register() |> recycle()

    conn = json_post(conn, "/api/economy/transaction", %{"delta" => -25})
    assert %{"ok" => true, "balance" => 75} = json_response(conn, 200)

    conn = conn |> recycle() |> json_post("/api/economy/transaction", %{"delta" => 5})
    assert %{"ok" => true, "balance" => 80} = json_response(conn, 200)

    # The change belongs to the account, not the connection.
    me = conn |> recycle() |> get("/api/auth/me")
    assert %{"user" => %{"balance" => 80}} = json_response(me, 200)
  end

  test "balance transactions reject a non-integer delta" do
    conn = register() |> recycle()
    conn = json_post(conn, "/api/economy/transaction", %{"delta" => "loot"})
    assert %{"ok" => false} = json_response(conn, 400)
  end

  test "unmatched /api routes return JSON even when html is requested" do
    conn =
      build_conn()
      |> put_req_header("accept", "text/html")
      |> get("/api/auth/regiter")

    assert %{"ok" => false} = json_response(conn, 404)
  end
end
